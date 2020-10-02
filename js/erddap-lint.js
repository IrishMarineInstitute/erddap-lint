(function(global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
        typeof define === 'function' && define.amd ? define(factory) :
        [global.ErddapLint] = factory();
}(this, (function() {
    'use strict';
    const $args = function(func){  
        return (func + '')
          .replace(/[/][/].*$/mg,'') // strip single-line comments
          .replace(/\s+/g, '') // strip white space
          .replace(/[/][*][^/*]*[*][/]/g, '') // strip multi-line comments
          .split(/\)[{=]/, 1)[0].replace(/^[^(]*[(]/, '') // extract the parameters
          .replace(/=[^,]+/g, '') // strip any ES6 defaults
          .split(',').filter(Boolean); // split & filter [""]
    }
    const JSONPfetcher = function() {
        this._promises = {};
    }
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
    const RuleSet = function(reference,markdown,context){
        this.reference = reference; // eg. url to markdown page
        this.acceptedDatasets = new Rule("builtin",0,"# Accepted Datasets\n```\n(dataset)=>true\n```");
        let line_no = 0;
        let rules = markdown.split(/^\s*(?=#[^#]+)/m).map(m =>
        {
                let rule = new Rule(reference, line_no, m, context);
                line_no += m.split("\n").length;
                return rule;
        });
        this.title = "";
        if(rules.length){
            this.title = rules[0].title;
        }
        // filter out any rules with no code, or not parsed.
        rules = rules.filter(rule=>rule.code && rule.codeRule);
        // assign the acceptedDatasets rule if one is defined.
        rules.filter(rule=>rule.title === "Accepted Datasets").map(rule=>this.acceptedDatasets=rule);
        // save the rules so we can apply them later agaist the datasets.
        this.rules = rules.filter(rule=>rule.title !== "Accepted Datasets");
    }

    RuleSet.prototype.accepts = function(context,dataset){
        return this.acceptedDatasets.accepts(context,dataset)
    }

    RuleSet.prototype.apply = function(context,dataset){
        return this.rules.map(rule=>{
            let accepts = rule.accepts(context,dataset)
            if(!accepts){
                context.log(`${dataset.url} rejected by ${rule.title}`)
            }
        }).reduce((accepted,accepts)=>accepted && accepts, true);
    }

    const CodeRule = function(name,code){
        this.name = name;
        this.fn = eval(code);
        let fntype = typeof(this.fn);
        if(fntype!=="function"){
            throw new Error(`Rule code does not define a function but is ${fntype}`);
        }
        let args = $args(this.fn);
        if(args.length !== 1){
            throw new Error("Rule function must take exactly one parameter");
        }
        this.args = args;
    }
    CodeRule.prototype.accepts = function(context,parameter){
        try{
            return this.fn(parameter);
        }catch(e){
            context.log(`ERROR: an exception was thrown by ${this.name}\n       ${e}`);
            return false;
        }
    }
    const Rule = function(reference, line_no, markdown, context){
        let lines = markdown.split("\n")
        this.title = lines[0].replace('#','').trim();
        let docs = [], code = [], incode = false;
        for(let i=1; i<lines.length; i++){
            let line = lines[i];
            if(line.match(REGEX_CODEFENCE)){
                if(incode){
                    incode = line_no+line;
                } else {
                    if(code.length){
                        context.log(`WARNING: rule ${this.title} has multiple code fences; only the first is used\n         ${reference} line ${line_no+i}`);
                    }else{
                        incode = true;
                    }
                }
                continue;
            }
            if(incode){
                code.push(line);
            }else{
                docs.push(line);
            }
        }
        this.docs = docs.join("\n");
        this.code = code.length?code.join("\n"):undefined;
        this.codeRule = new CodeRule(this.title,"(dataset)=>true");
        if(this.code){
            try{
                this.codeRule = new CodeRule(this.title,this.code);
            }catch(e){
                let msg = e.toString().split("\n");
                context.log(`ERROR: invalid function for rule ${this.title}\n       ${msg}\n       ${reference} line ${incode}`)
            }
        }

    }

    Rule.prototype.accepts = function(context, dataset){
        let variable_accepts = (variables)=>{
            return variables.map(v=>{
                    if(this.codeRule.accepts(context,v)){
                        return true;
                    }
                    context.log(`${this.title} rejected for variable ${v.name}`)
                }).reduce((accepted,accepts)=>accepted && accepts, true)
        }
        let dimension_accepts = (dimensions)=>{
                return dimensions.map(d=>{
                    if(this.codeRule.accepts(context,d)){
                        return true;
                    }
                    context.log(`${this.title} rejected for dimension ${d.name}`)
                }).reduce((accepted,accepts)=>accepted && accepts, true)
        }
        let ncglobal_accepts = ()=>{
            return Object.entries(dataset.NC_GLOBALS.attributes).map(([k,v])=>v).map(a=>{
                    if(this.codeRule.accepts(context,a)){
                        return true;
                    }
                    context.log(`${this.title} rejected for NC_GLOBAL attribute ${a.name}`)
                }).reduce((accepted,accepts)=>accepted && accepts, true)
        }
        let parameter = this.codeRule.args[0];
        switch(parameter){
            case 'dataset':{
                return this.codeRule.accepts(context,dataset);
            }
            case 'NC_GLOBALS':
                return this.codeRule.accepts(context,dataset.NC_GLOBALS);
            case 'NC_GLOBAL':
                return ncglobal_accepts();
            case 'variable':
                 return variable_accepts(dataset.variables);
            case 'dimension':
                 return dimension_accepts(dataset.dimensions);
            case 'variable_or_dimension':
                let a = variable_accepts(dataset.variables);
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
         if(dataset.NC_GLOBALS.attributes.filter(a=>a.name === parameter).length){
            let accepts = this.codeRule.accepts(context,dataset.NC_GLOBALS);
            if(!accepts){
                context.log("rejected for NC_GLOBALS")
            }
            results.push(accepts);
         }
         let variables = dataset.variables.filter(v=>v.name === parameter || v.attributes.filter(a=>a.name === parameter));
         results.push(variable_accepts(variables));
         let dimensions = dataset.variables.filter(d=>d.name === parameter || d.attributes.filter(a=>a.name === parameter));
         results.push(dimension_accepts(dimensions));
         return results.reduce((accepted,accepts)=>accepted && accepts, true);
    }
    const fetcher = new JSONPfetcher();
    const ErddapLint = function(){
        this.context = {
            log: (x)=>console.log(x)
        }
        this.ruleSets = [];
    }
    ErddapLint.prototype.fetchRules = function(urls){
        return Promise.all(urls.map(
                url=>fetch(url)
                .then(r=>r.text())
                .then(markdown=>new RuleSet(url,markdown,this.context))
                .then(ruleSet=>this.ruleSets.push(ruleSet)))
        ).then(()=>this)
    }
    ErddapLint.prototype.applyRules = function(dataset,context){
        context = context || this.context;
        this.ruleSets.filter(ruleSet=>ruleSet.accepts(context,dataset)).map(ruleSet=>ruleSet.apply(context,dataset));
    }
    ErddapLint.prototype.fetchDataset = function(datasetUrl){
        let promise = fetch(datasetUrl).then(x=>x.json()).then(x=>x.table.rows).then(rows=>{
                let dataset = {
                    url: datasetUrl,
                    NC_GLOBALS: {name: "NC_GLOBAL", type: "NC_GLOBAL", attributes: {}},
                    variables: [],
                    dimensions: []
                };
                dataset.NC_GLOBALS.dataset = dataset;
                let current = dataset.NC_GLOBALS;
                rows.forEach(row => {
                    let [rowType, varName, attrName, dataType, value] = row;
                    switch (rowType) {
                        case "variable":
                            current = {name: varName, type: "variable", dataset: dataset, attributes: {}};
                            dataset.variables.push(current);
                            break;
                        case "dimension":
                            current = {name: varName, type: "dimension", dataset: dataset, attributes: {}};
                            dataset.dimensions.push(current);
                            break;
                        case "attribute":
                            if(varName !== current.name){
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

    return [ErddapLint];
})));