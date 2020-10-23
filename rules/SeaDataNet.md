# SeaDataNet Rules

Check vocabulary terms used to populate SeaDataNet variable attributes and provide replacement values where a term has been deprecated.


# Accepted Datasets
Just the ones at marine.ie for now

```javascript
(dataset)=>{
    let has_sdnvars = dataset.variables.map(v=>v.attributes.sdn_parameter_urn||v.attributes.sdn_parameter_urn).filter(b=>b).length>0;
    if(!has_sdnvars){
        return false;
    }
    if(!memo.sdn_configured){
        memo.sdn_configured = true;
        let getVocabSparql = function(vocab_name){
        return `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX dct: <http://purl.org/dc/terms/>
    
select distinct ?vocab ?urn ?name ?deprecated_status
where {
?a skos:member ?url .
?url skos:prefLabel ?name .
?url skos:notation ?urn .
?url owl:deprecated ?deprecated_status .
FILTER(CONTAINS(str(?a),"http://vocab.nerc.ac.uk/collection/${vocab_name}/current/")) .
BIND(REPLACE(REPLACE(str(?a),"http://vocab.nerc.ac.uk/collection/","","i"),"/current/","","i") AS ?vocab) .
}`
    };
        let getVocabReplacementsSparql = function(vocab_name){
        return `PREFIX dct: <http://purl.org/dc/terms/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

select ?vocab ?deprecated_urn ?deprecated_name ?replacement_urn ?replacement_name
where {
?b <http://purl.org/dc/terms/isReplacedBy> ?c .
?a skos:member ?b .
?a skos:member ?c .
?b skos:notation ?deprecated_urn .
?c skos:notation ?replacement_urn .
?b skos:prefLabel ?deprecated_name .
?c skos:prefLabel ?replacement_name .
FILTER(CONTAINS(str(?a),"http://vocab.nerc.ac.uk/collection/${vocab_name}/current/")) . 
BIND(REPLACE(REPLACE(str(?a),"http://vocab.nerc.ac.uk/collection/","","i"),"/current/","","i") AS ?vocab) .
}`       
    };
        let fetchSparql = function(sparql,key){
            let memo_key = `sdn_fetchSparql_${key}`;
            let url = "https://vocab.nerc.ac.uk/sparql/sparql?output=csv&force-accept=text%2Fplain"
            let sparqlurl = `${url}&query=${encodeURIComponent(sparql)}`;
            //memoize the query result so we only run it once.
            memo[memo_key] = memo[memo_key] || fetch(sparqlurl).then(x=>x.text()).then(text=>{
                let lines = text.split("\n");
                lines.shift;
                return lines.map(line=>line.split(","));
            });
            return memo[memo_key];
        }
        let getVocab = function(vocab_name){
            return fetchSparql(getVocabSparql(vocab_name),`${vocab_name}_vocab`);
        }
        let getVocabReplacements = function(vocab_name){
            return fetchSparql(getVocabReplacementsSparql(vocab_name),`${vocab_name}_vocab_replacements`);
        }

        let sdn_attributes_vocab_test = function(dataset,vocab_name,urn,name,done){
            getVocab(vocab_name).then(vocab=>{
                getVocabReplacements(vocab_name).then(replacements=>{
                    let errors = [];
                    dataset.variables.forEach(variable=>{
                        if(variable.attributes[urn]){
                            if(!variable.attributes[name]){
                                errors.push(`${variable.name}.${urn} is defined, but no ${variable.name}.${name}`)
                            }
                            let urn_value = variable.attributes[urn].value;
                            let evocab = vocab.filter(e=>e[1]===urn_value);
                            if(!evocab.length){
                                errors.push(`${variable.name}.${urn}=${urn_value} is not in the NVS`)
                                return;
                            }
                            evocab = evocab[0];
                            if(evocab[3] === 'true'){
                                errors.push(`${variable.name}.${urn}=${urn_value} is deprecated in the NVS`);
                                let new_value = replacements.filter(v=>v[1]===urn_value)[0];
                                if(new_value){
                                    errors.push(`(new value=${new_value[2]})`)
                                }
                                return;
                            }
                            if(variable.attributes[name]){
                                let name_value = variable.attributes[name].value;
                                if(name_value !== evocab[2]){
                                    errors.push(`${variable.name}.${name} does not match the expected value for ${urn_value}`);
                                    errors.push(`        actual: "${name_value}"`)
                                    errors.push(`      expected: "${evocab[2]}"`)
                                }
                            }
                            return;
                        }
                        if(variable.attributes[name]){
                            errors.push(`${variable.name}.${name} is defined, but no ${variable.name}.${urn}`)
                        }
                    })
                    if(errors.length){
                        done(errors.join("\n                "));
                    }else{
                        done();
                    }
                })
            })
        }
        memo.sdn_attributes_vocab_test = sdn_attributes_vocab_test;

    }

    return true;
}
```




# Check P01 terms

Check the following variable attributes against the SDN vocabulary available from the NVS SPARQL endpoint.

sdn_parameter_urn should be present in column CODVAL and sdn_parameter_name should match column preflabel for the query run against vocabulary P01 and deprecated status should be "false"
for

 * Where an URN attribute value is not present in the CODVAL list returned from the query show an error.
 * Where an URN attribute value is present in the CODVAL list but has a deprecation status of "true" report a warning and advise of the replacement term.
 * Where a NAME attribute value does not match the PREFLABEL for the associated URN/CODVAL match report a warning and advise of the updated PREFLABEL.

Timeout: 30000
```
(dataset,done)=>memo.sdn_attributes_vocab_test(dataset,'P01','sdn_parameter_urn','sdn_parameter_name',done)
```

# Check P06 terms

Check the following variable attributes against the SDN vocabulary available from the NVS SPARQL endpoint.

sdn_uom_urn should be present in column CODVAL and sdn_uom_name should match column preflabel for the query run against vocabulary P06 and deprecated status should be "false"
for

 * Where an URN attribute value is not present in the CODVAL list returned from the query show an error.
 * Where an URN attribute value is present in the CODVAL list but has a deprecation status of "true" report a warning and advise of the replacement term.
 * Where a NAME attribute value does not match the PREFLABEL for the associated URN/CODVAL match report a warning and advise of the updated PREFLABEL.

Timeout: 30000
```
(dataset,done)=>memo.sdn_attributes_vocab_test(dataset,'P06','sdn_uom_urn','sdn_uom_name',done)
```

# Check L22 terms

Check the following variable attributes against the SDN vocabulary available from the NVS SPARQL endpoint.

sdn_instrument_urn should be present in column CODVAL and sdn_instrument_name should match column preflabel for the query run against vocabulary L22 and deprecated status should be "false"
for

 * Where an URN attribute value is not present in the CODVAL list returned from the query show an error.
 * Where an URN attribute value is present in the CODVAL list but has a deprecation status of "true" report a warning and advise of the replacement term.
 * Where a NAME attribute value does not match the PREFLABEL for the associated URN/CODVAL match report a warning and advise of the updated PREFLABEL.

Timeout: 30000
```
(dataset,done)=>memo.sdn_attributes_vocab_test(dataset,'L22','sdn_instrument_urn','sdn_instrument_name',done)
```