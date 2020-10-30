(function(global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
        typeof define === 'function' && define.amd ? define(factory) :
        global.ErddapLint = factory();
}(this, (function() {
    'use strict';
    const $args = function(func) {
        return (func + '')
            .replace(/[/][/].*$/mg, '') // strip single-line comments
            .replace(/\s+/g, '') // strip white space
            .replace(/[/][*][^/*]*[*][/]/g, '') // strip multi-line comments
            .split(/\)[{=]/, 1)[0].replace(/^[^(]*[(]/, '') // extract the parameters
            .replace(/=[^,]+/g, '') // strip any ES6 defaults
            .split(',').filter(Boolean); // split & filter [""]
    }
    const JSONPfetcher = function() {
        this._promises = {};
    }
    let jsonpID = 0;
    JSONPfetcher.prototype.fetch = function(url, options) {
        // derived from https://blog.logrocket.com/jsonp-demystified-what-it-is-and-why-it-exists/
        options = options || {};
        if (!this._promises[url]) {
            let head = document.querySelector('head');
            let timeout = options.timeout || 15000;
            let callbackName = options.callbackName || `jsonpCallback${jsonpID}`;
            jsonpID += 1;
            let promise = new Promise((resolve, reject) => {
                let script = document.createElement('script');

                let cleanUp = () => {
                    delete window[callbackName];
                    head.removeChild(script);
                    window.clearTimeout(timeoutId);
                    script = null;
                    delete this._promises[url];
                }

                script.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + `.jsonp=${callbackName}`;
                script.async = true;

                let timeoutId = window.setTimeout(() => {
                    cleanUp();

                    return reject(new Error('Timeout'));
                }, timeout);

                window[callbackName] = data => {
                    cleanUp();

                    return resolve(data);
                };

                script.addEventListener('error', error => {
                    cleanUp();
                    return reject(error);
                });

                head.appendChild(script);
            });
            this._promises[url] = promise;
        }
        return this._promises[url];
    }
    const REGEX_CODEFENCE = /\`\`\`/;
    const RuleSet = function(reference, markdown, context) {
        this.reference = reference; // eg. url to markdown page
        this.filename = reference.split('/').reverse()[0];
        this.name = this.filename.split('.')[0];
        this.acceptedDatasets = new Rule("builtin", 0, "# Accepted Datasets\n```\n(dataset)=>true\n```");
        let line_no = 0;
        let rules = markdown.split(/^\s*(?=#[^#]+)/m).map(m => {
            let rule = new Rule(reference, line_no, m, context);
            line_no += m.split("\n").length;
            return rule;
        });
        this.title = "";
        if (rules.length) {
            this.title = rules[0].title;
        }
        // filter out any rules with no code, or not parsed.
        rules = rules.filter(rule => rule.code && rule.codeRule);
        // assign the acceptedDatasets rule if one is defined.
        rules.filter(rule => rule.title === "Accepted Datasets").map(rule => this.acceptedDatasets = rule);
        // save the rules so we can apply them later agaist the datasets.
        this.rules = rules.filter(rule => rule.title !== "Accepted Datasets");
    }

    RuleSet.prototype.accepts = function(context, dataset) {
        return this.acceptedDatasets.accepts(context, dataset)
    }

    RuleSet.prototype.apply = function(context, dataset) {
        return this.rules.map(rule => {
            let accepts = rule.accepts(context, dataset)
            if (!accepts) {
                context.log(`${dataset.url} rejected by ${rule.title}`)
            }
        }).reduce((accepted, accepts) => accepted && accepts, true);
    }

    const CodeRule = function(name, code) {
        this.name = name;
        this.fn = eval(code);
        let fntype = typeof(this.fn);
        if (fntype !== "function") {
            throw new Error(`Rule code does not define a function but is ${fntype}`);
        }
        let args = $args(this.fn);
        if (args.length !== 1) {
            if (args.length === 2 && args[1] === "done") {
                // okay
            } else {
                throw new Error("Rule function must take exactly one parameter, or two if second parameter is 'done'");
            }
        }
        this.args = args;
    }
    CodeRule.prototype.accepts = function(context, parameter, done) {
        try {
            return this.fn(parameter, done);
        } catch (e) {
            if (e instanceof chai.AssertionError) {
                delete e.stack;
                throw e;
            }
            context.log(`ERROR: an exception was thrown by ${this.name}\n       ${e}`);
            return false;
        }
    }
    const Rule = function(reference, line_no, markdown, context) {
        let lines = markdown.split("\n")
        this.title = lines[0].replace('#', '').trim();
        this.timeout = false;
        this.ignore_dataset_ids = [];
        let re_timeout = /^\s*timeout:\s*(\d+)\s*$/i;
        let re_inignore = /Dataset ids to ignore for this rule/i;
        let re_listitem = /^\s+[-\*]\s*(\S+)\s*$/;
        let docs = [],
            code = [],
            incode = false,
            inignore = false;
        for (let i = 1; i < lines.length; i++) {
            let line = lines[i];
            if (line.match(REGEX_CODEFENCE)) {
                if (incode) {
                    incode = line_no + line;
                } else {
                    if (code.length) {
                        context.log(`WARNING: rule ${this.title} has multiple code fences; only the first is used\n         ${reference} line ${line_no+i}`);
                    } else {
                        incode = true;
                    }
                }
                continue;
            }
            if (incode) {
                code.push(line);
            } else {
                docs.push(line);
                if(line.match(re_timeout)){
                    this.timeout = parseInt(line.match(re_timeout)[1]);
                }
                if(line.match(re_inignore)){
                    inignore = true;
                    continue;
                }
                if(inignore){
                    if(this.ignore_dataset_ids.length === 0 && line.match(/^\s*$/)){
                        continue;
                    }
                    if(!line.match(re_listitem)){
                        inignore = false;
                        continue;
                    }
                    this.ignore_dataset_ids.push(line.match(re_listitem)[1]);
                }
            }
        }
        this.docs = docs.join("\n");
        this.code = code.length ? code.join("\n") : undefined;
        this.codeRule = new CodeRule(this.title, "(dataset)=>true");
        if (this.code) {
            try {
                this.codeRule = new CodeRule(this.title, this.code);
            } catch (e) {
                let msg = e.toString().split("\n");
                context.log(`ERROR: invalid function for rule ${this.title}\n       ${msg}\n       ${reference} line ${incode}`)
                this.codeRule = new CodeRule(this.title, "(dataset)=>chai.assert.fail('the function is invalid')");
            }
        }

    }

    Rule.prototype.accepts = function(context, dataset, mochaDone) {
        if(this.ignore_dataset_ids.indexOf(dataset.id)>=0){//ignore this dataset for this test.
            if(mochaDone){
                mochaDone();
            }
            return true;
        }
        let promises = [];
        let utdone = function(lastOne){
            if(!mochaDone) return undefined;
            let done = undefined;
            let promise = new Promise((resolve)=>{done=resolve});
            promises.push(promise);
            if(lastOne){
                setTimeout(()=>{Promise.all(promises).then(results=>{
                    let fails = results.filter(result=>result).map(e=>`${e}`);
                    if(fails.length){
                        let err = new chai.AssertionError(fails.join("\n                "));
                        delete err.stack;
                        mochaDone(err);
                    }else{
                        mochaDone();
                    }
                })},0);
            }
            return done;
        }
        let variable_accepts = (variables,more) => {
            return variables.map(v => {
                if (this.codeRule.accepts(context, v, utdone(more?false:true))) {
                    return true;
                }
                context.log(`${this.title} rejected for variable ${v.name}`)
            }).reduce((accepted, accepts) => accepted && accepts, true)
        }
        let dimension_accepts = (dimensions,more) => {
            return dimensions.map(d => {
                if (this.codeRule.accepts(context, d, utdone(more?false:true))) {
                    return true;
                }
                context.log(`${this.title} rejected for dimension ${d.name}`)
            }).reduce((accepted, accepts) => accepted && accepts, true)
        }
        let ncglobal_accepts = (more) => {
            return Object.entries(dataset.NC_GLOBALS.attributes).map(([k, v]) => v).map(a => {
                if (this.codeRule.accepts(context, a, utdone(more?false:true))) {
                    return true;
                }
                context.log(`${this.title} rejected for NC_GLOBAL attribute ${a.name}`)
            }).reduce((accepted, accepts) => accepted && accepts, true)
        }
        let parameter = this.codeRule.args[0];
        switch (parameter) {
            case 'dataset':
                {
                    return this.codeRule.accepts(context, dataset, utdone(true));
                }
            case 'NC_GLOBALS':
                return this.codeRule.accepts(context, dataset.NC_GLOBALS, utdone(true));
            case 'NC_GLOBAL':
                return ncglobal_accepts();
            case 'variable':
                return variable_accepts(dataset.variables);
            case 'dimension':
                return dimension_accepts(dataset.dimensions);
            case 'variable_or_dimension':
                let a = variable_accepts(dataset.variables,true);
                let b = dimension_accepts(dataset.dimensions);
                return a && b;
            default:
                break;
        }
        /*
         Called once for each variable or dimension named ${parameter} 
         or having an attribute named ${parameter}, including NC_GLOBAL
         */
        let results = [];
        if (Object.entries(dataset.NC_GLOBALS.attributes).filter(([key,a]) => a.name === parameter).length) {
            let accepts = this.codeRule.accepts(context, dataset.NC_GLOBALS,utdone(true));
            if (!accepts) {
                context.log("rejected for NC_GLOBALS")
            }
            results.push(accepts);
        }
        let variables = dataset.variables.filter(v => v.name === parameter || Object.entries(v.attributes).filter(([key,a])  => a.name === parameter).length);
        results.push(variable_accepts(variables,true));
        let dimensions = dataset.dimensions.filter(d => d.name === parameter || Object.entries(d.attributes).filter(([key,a])  => a.name === parameter).length);
        results.push(dimension_accepts(dimensions,true));
        utdone(true)();
        return results.reduce((accepted, accepts) => accepted && accepts, true);
    }
    const fetcher = (typeof window === 'undefined') ? { fetch: (x)=>fetch(x).then(r=>r.json())} : new JSONPfetcher();
    const ErddapLint = function() {
        this.context = {
            log: (x) => console.log(x)
        }
        this.ruleSets = [];
    }
    const memo = {
        foo: "bar"
    };
    ErddapLint.prototype.fetchRules = function(urls,ruleTitlePattern) {
        return Promise.all(urls.map(
            url => fetch(url)
            .then(r => r.text())
            .then(markdown => this.addRuleSetFromMarkdown(url,markdown,ruleTitlePattern))));
    }

    ErddapLint.prototype.addRuleSetFromMarkdown = function(url, markdown, ruleTitlePattern) {
        let ruleSet = new RuleSet(url, markdown, this.context, ruleTitlePattern);
        this.ruleSets.push(ruleSet);
        return this;
    }

    ErddapLint.prototype.getRuleSets = function(dataset, context) {
        return this.ruleSets.filter(ruleSet => ruleSet.accepts(context || this.context, dataset));
    }

    ErddapLint.prototype.applyRules = function(dataset, context) {
        context = context || this.context;
        this.ruleSets.filter(ruleSet => ruleSet.accepts(context, dataset)).map(ruleSet => ruleSet.apply(context, dataset));
    }

    ErddapLint.prototype.fetchDataset = function(datasetUrl) {
        let dsid = datasetUrl.replace(/\/[^\/]*$/,"").split("/").pop();
        let promise = fetch(datasetUrl).then(x => x.json()).then(x => x.table.rows).then(rows => {
            let dataset = {
                id: dsid,
                url: datasetUrl,
                NC_GLOBALS: {
                    name: "NC_GLOBAL",
                    type: "NC_GLOBAL",
                    attributes: {}
                },
                variables: [],
                dimensions: []
            };
            dataset.NC_GLOBALS.dataset = dataset;
            let current = dataset.NC_GLOBALS;
            rows.forEach(row => {
                let [rowType, varName, attrName, dataType, value] = row;
                switch (rowType) {
                    case "variable":
                        current = {
                            name: varName,
                            type: "variable",
                            dataset: dataset,
                            attributes: {}
                        };
                        dataset.variables.push(current);
                        break;
                    case "dimension":
                        current = {
                            name: varName,
                            type: "dimension",
                            dataset: dataset,
                            attributes: {}
                        };
                        dataset.dimensions.push(current);
                        break;
                    case "attribute":
                        if (varName !== current.name) {
                            throw new Error(`wrong varName expected ${current.name} but got ${varName}`);
                        }
                        current.attributes[attrName] = {
                            object: current,
                            name: attrName,
                            type: dataType,
                            value: value
                        };
                        break;
                    default:
                        throw new Error("unexpected data: " + row.join(", "));
                }
            });
            return dataset;
        });
        return promise;
    }

    ErddapLint.prototype.prepareMochaTestsForDataset = function(datasetUrl,hash) {
        hash = hash || `#erddap=${datasetUrl.replace(/\/info\/.*$/,'')}`;
        return this.fetchDataset(datasetUrl).then(dataset => {
            let ruleSets = this.getRuleSets(dataset);
            ruleSets.forEach(ruleSet => {
                describe(dataset.NC_GLOBALS.attributes.title.value, function() {
                    this.link=`#dataset=${datasetUrl}`;
                    describe(ruleSet.title, function() {
                        this.link=`${hash}&rules=${ruleSet.name}`;
                        ruleSet.rules.map(rule => {
                            let messages = [];
                            let context = {
                                log: (text) => messages.push(text)
                            }
                            if (rule.codeRule.args.length == 2) {
                                it(rule.title, function(done) {
                                    this.test.body = `# ${rule.title}\n\n${rule.docs}\n\n\`\`\`\n${rule.code}\n\`\`\`\n`;
                                    if(rule.timeout){
                                        this.timeout(rule.timeout);
                                    }
                                    rule.accepts(context, dataset, done);
                                });
                            } else {
                                it(rule.title, function() {
                                    this.test.body = `# ${rule.title}\n\n${rule.docs}\n\n\`\`\`\n${rule.code}\n\`\`\`\n`;
                                    if (rule.accepts(context, dataset)) {
                                        chai.assert(true);
                                    } else {
                                        try {
                                            chai.assert.fail(`${rule.title}\n${messages.join("\n")}`)
                                        } catch (e) {
                                            delete e.stack;
                                            throw e;
                                        }
                                    }
                                });
                            }
                        });
                    });
                })
            });
            return true;
        });
    }

    ErddapLint.prototype.prepareMochaTestsForErddap = function(erddap,statuscb) {
        let searchURL = erddap + "/search/index.json?page=1&itemsPerPage=1000&searchFor=latitude";
        statuscb && setTimeout(()=>statuscb('searching for datasets'),0)
        return fetcher.fetch(searchURL).then(data => {
            let infocol = data.table.columnNames.indexOf("Info");
            let urls = data.table.rows.map(x => x[infocol]);
            return new Promise((resolve, reject) => {
                let prepareNextUrl = () => {
                    let url = urls.shift();
                    if (url) {
                        statuscb && setTimeout(()=>statuscb(`fetching ${url}`),0)
                        this.prepareMochaTestsForDataset(url,`#erddap=${erddap}`).then(_ => {
                            prepareNextUrl();
                        });
                    } else {
                        statuscb && setTimeout(()=>statuscb("ready"),0)
                        resolve(true);
                    }
                }
                prepareNextUrl();
            })
        });

    }
    return ErddapLint;
})));