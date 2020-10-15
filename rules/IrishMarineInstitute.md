# Marine Institute Rules

Some rules specific to [Irish Marine Institute](https://www.marine.ie/)

# Accepted Datasets
Just the ones at marine.ie for now

```javascript
(dataset)=>dataset.url.indexOf("marine.ie/")>=0||dataset.url.indexOf("digitalocean.ie/")>=0;
```

# Must Link to a data catalogue record
The infoUrl must link to a catalogue record at data.marine.ie

```javascript
(NC_GLOBALS)=>{
    if(NC_GLOBALS.infoUrl && NC_GLOBALS.infoUrl.value.indexOf('data.marine.ie')>=0){
        return true;
    }
    chai.assert.fail(`NC_GLOBAL.infoUrl does not link to a catalogue record at data.marine.ie`)
}
```

# NC_GLOBAL.institution should be "Marine Institute, Ireland"

Where the institution name is like `Marine Institute` it must read `Marine Institute, Ireland`
```javascript
(NC_GLOBALS)=>{
  if(!NC_GLOBALS.attributes.institution){
    return false; //needs to be here.
  }
  let institution = NC_GLOBALS.attributes.institution.value;
  let expected = "Marine Institute, Ireland";
  if(institution.toLowerCase().indexOf("marine institute")>=0){
    if(institution !== expected){
        chai.assert.fail(`institution is "${institution}" but should be "${expected}"`)
    }
  }
  return true;
}

```

# ISO 8601 Date Time Formats in titles and abstracts
All dates/times in ERDDAP dataset titles or abstracts must follow ISO 8601 Date & Time format

```javascript
(NC_GLOBALS)=>{
    let bad_date_pattern = /\b(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)[,]{0,1}.\d{4}/;
    let messages = [];
    ['title','summary'].forEach(attr=>{
        let bad_date = NC_GLOBALS.attributes[attr].value.match(bad_date_pattern);
        if(bad_date){
            messages.push(`NC_GLOBAL.${attr} contains the date ${bad_date[0]}`);
        }
    })
    if(messages.length){
        chai.assert.fail(messages.join("\n                "));
    }
    return true;
}
```

# ISO 8601 Date Time format in date time attributes
All date/times in the following Erddap global attributes must follow the ISO 8601 Date & Time format:
- date_created
- date_modified
- time_coverage_start
- time_coverage_end

```javascript
(NC_GLOBALS)=>{
    let valid_iso_8601_pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
       let messages = [];
    ['date_created','date_modified','time_coverage_start','time_coverage_end'].forEach(attr=>{
        if(!NC_GLOBALS.attributes[attr]){
            return;
        }
        if(!NC_GLOBALS.attributes[attr].value.match(valid_iso_8601_pattern)){
            messages.push(`NC_GLOBAL.${attr} fails iso 8601 ${NC_GLOBALS.attributes[attr].value}`);
        }
    })
    if(messages.length){
        chai.assert.fail(messages.join("\n                "));
    }
    return true;
}

```

# standard_name attribute is in the master vocabulary on the NVS, and not deprecated
Query for all non-deprecated terms in the CF vocabulary from the NVS SPARQL endpoint (http://vocab.nerc.ac.uk/sparql):

Timeout: 45000

```javascript
(standard_name,done)=>{
    let variable = standard_name;
    let standard_names_sparql = `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX dct: <http://purl.org/dc/terms/>
select distinct ?vocab ?preflabel ?deprecated
where {
?a skos:member ?url .
?url skos:prefLabel ?preflabel .
?url skos:altLabel ?altlabel .
?url dct:date ?published .
?url owl:versionInfo ?version .
?url skos:notation ?c .
?url skos:definition ?definition .
?url owl:deprecated ?deprecated .
FILTER(CONTAINS(str(?a),"http://vocab.nerc.ac.uk/collection/P07/current/") && ?deprecated = "false") .
BIND(REPLACE(REPLACE(str(?a),"http://vocab.nerc.ac.uk/collection/","","i"),"/current/","","i") AS ?vocab) .
BIND(REPLACE(str(?c),CONCAT("SDN:",?vocab,"::"),"","i") AS ?codval) .
}`
    let new_standard_names_sparql = `PREFIX dct: <http://purl.org/dc/terms/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

select ?vocab ?deprecated_standard_name ?replacement_standard_name
where {
    ?b <http://purl.org/dc/terms/isReplacedBy> ?c .
    ?a skos:member ?b .
    ?a skos:member ?c .
    ?b skos:prefLabel ?deprecated_standard_name .
    ?c skos:prefLabel ?replacement_standard_name .
    FILTER(CONTAINS(str(?a),"http://vocab.nerc.ac.uk/collection/P07/current/")) .
    BIND(REPLACE(REPLACE(str(?a),"http://vocab.nerc.ac.uk/collection/","","i"),"/current/","","i") AS ?vocab) .
}`;
    let url = "http://vocab.nerc.ac.uk/sparql/sparql?output=csv&force-accept=text%2Fplain"
    let sparqlurl = `${url}&query=${encodeURIComponent(standard_names_sparql)}`;
    //memoize the query result so we only run it once.
    memo.fetch_standard_names = memo.fetch_standard_names || fetch(sparqlurl).then(x=>x.text()).then(text=>{
        let lines = text.split("\n");
        lines.shift;
        return [lines.map(line=>line.split(",")[1]),lines.map(line=>line.split(",")[2])];
    });
    sparqlurl = `${url}&query=${encodeURIComponent(new_standard_names_sparql)}`;
    memo.fetch_new_standard_names = memo.fetch_new_standard_names || fetch(sparqlurl).then(x=>x.text()).then(text=>{
        let lines = text.split("\n");
        lines.shift;
        return [lines.map(line=>line.split(",")[1]),lines.map(line=>line.split(",")[2])];
    });
    if(!(variable && variable.attributes && variable.attributes.standard_name)){
        console.log("unexpected variable/dimension", variable);
        done();
        return;
    }
    standard_name = variable.attributes.standard_name.value;
    memo.fetch_new_standard_names.then(([old_names,new_names])=>{
        let i = old_names.indexOf(standard_name);
        if(i>=0){
            let new_name = new_names[i];
            let msg = `${variable.name}.standard_name "${standard_name}" is deprecated in the NVS`;
            done(`${msg}, replaced with "${new_name}"`)
        }else{
            memo.fetch_standard_names.then(([standard_names,deprecates])=>{
               if(standard_names.indexOf(standard_name)>=0){
                    done();
                }else{
                    done(`${variable.name}.standard_name "${standard_name}" is not in the NVS `)
                }
            });
        }
    })
}
```

# Check vocabulary terms used to populate SeaDataNet variable attributes and suggest replacement values as a warning where a term has been deprecated
Check the following variable attributes against the SDN vocabulary available from the NVS SPARQL endpoint (query(1) below) using the logic:

... should be present in column CODVAL and ... should match column preflabel for the query run against vocabulary ... and deprecated status should be "false"
for
1. sdn_parameter_urn ... sdn_parameter_name ... P01 ... 
2. sdn_uom_urn ... sdn_uom_name ... P06 ...
3. sdn_instrument_urn ... sdn_instrument_name ... L22 ...

Where an URN attribute value is not present in the CODVAL list returned from the query show an error.
Where an URN attribute value is present in the CODVAL list but has a deprecation status of "true" report a warning and advise of the replacement term using query(2) below.
Where a NAME attribute value does not match the PREFLABEL for the associated URN/CODVAL match report a warning and advise of the updated PREFLABEL.

query(1)
"""PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX dct: <http://purl.org/dc/terms/>
    
select distinct ?vocab ?urn ?name ?deprecated_status
where {
?a skos:member ?url .
?url skos:prefLabel ?name .
?url skos:notation ?urn .
?url owl:deprecated ?deprecated_status .
FILTER(CONTAINS(str(?a),"http://vocab.nerc.ac.uk/collection/P06/current/")) .                ## insert appropriate vocab name in this line instead of "P06"
BIND(REPLACE(REPLACE(str(?a),"http://vocab.nerc.ac.uk/collection/","","i"),"/current/","","i") AS ?vocab) .
}"""

query(2)

"""
PREFIX dct: <http://purl.org/dc/terms/>
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
    FILTER(CONTAINS(str(?a),"http://vocab.nerc.ac.uk/collection/P06/current/")) .              ## insert appropriate vocab name in this line instead of "P06"
    BIND(REPLACE(REPLACE(str(?a),"http://vocab.nerc.ac.uk/collection/","","i"),"/current/","","i") AS ?vocab) .
    }
"""
