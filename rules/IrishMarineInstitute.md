# Marine Institute Rules

Some rules specific to [Irish Marine Institute](https://www.marine.ie/)

# Accepted Datasets
Just the ones at marine.ie for now

```javascript
(dataset)=>dataset.url.indexOf("marine.ie/")>=0;
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

```
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

# When standard_name attribute is populated the value is not deprecated in the master vocabulary on the NVS
Query for all non-deprecated terms in the CF vocabulary from the NVS SPARQL endpoint (http://vocab.nerc.ac.uk/sparql):

"""PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
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
}"""

As a URL returing JSON:
http://vocab.nerc.ac.uk/sparql/sparql?query=PREFIX+skos%3A+%3Chttp%3A%2F%2Fwww.w3.org%2F2004%2F02%2Fskos%2Fcore%23%3E%0D%0APREFIX+owl%3A+%3Chttp%3A%2F%2Fwww.w3.org%2F2002%2F07%2Fowl%23%3E%0D%0APREFIX+dct%3A+%3Chttp%3A%2F%2Fpurl.org%2Fdc%2Fterms%2F%3E%0D%0A%0D%0Aselect+distinct+%3Fvocab+%3Fpreflabel+%3Fdeprecated%0D%0Awhere+%7B%0D%0A%3Fa+skos%3Amember+%3Furl+.%0D%0A%3Furl+skos%3AprefLabel+%3Fpreflabel+.%0D%0A%3Furl+skos%3AaltLabel+%3Faltlabel+.%0D%0A%3Furl+dct%3Adate+%3Fpublished+.%0D%0A%3Furl+owl%3AversionInfo+%3Fversion+.%0D%0A%3Furl+skos%3Anotation+%3Fc+.%0D%0A%3Furl+skos%3Adefinition+%3Fdefinition+.%0D%0A%3Furl+owl%3Adeprecated+%3Fdeprecated+.%0D%0AFILTER%28CONTAINS%28str%28%3Fa%29%2C%22http%3A%2F%2Fvocab.nerc.ac.uk%2Fcollection%2FP07%2Fcurrent%2F%22%29+%26%26+%3Fdeprecated+%3D+%22true%22%29+.%0D%0ABIND%28REPLACE%28REPLACE%28str%28%3Fa%29%2C%22http%3A%2F%2Fvocab.nerc.ac.uk%2Fcollection%2F%22%2C%22%22%2C%22i%22%29%2C%22%2Fcurrent%2F%22%2C%22%22%2C%22i%22%29+AS+%3Fvocab%29+.%0D%0ABIND%28REPLACE%28str%28%3Fc%29%2CCONCAT%28%22SDN%3A%22%2C%3Fvocab%2C%22%3A%3A%22%29%2C%22%22%2C%22i%22%29+AS+%3Fcodval%29+.%0D%0A%7D&output=json&stylesheet=

# When the standard_name attibute is deprecated in the master vocabulary on the NVS then report the replacement standard_name term
Query for all deprecated terms and replacements in the CF vocabulary from the NVS SPARQL endpoint (http://vocab.nerc.ac.uk/sparql):

PREFIX dct: <http://purl.org/dc/terms/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
select ?vocab ?prpreflabel ?obpreflabel
where {
    ?b <http://purl.org/dc/terms/isReplacedBy> ?c .
    ?a skos:member ?b .
    ?a skos:member ?c .
    ?b skos:prefLabel ?p .
    ?c skos:prefLabel ?o .
    FILTER(CONTAINS(str(?a),"http://vocab.nerc.ac.uk/collection/P07/current/")) .
    BIND(REPLACE(REPLACE(str(?a),"http://vocab.nerc.ac.uk/collection/","","i"),"/current/","","i") AS ?vocab) .
    BIND(REPLACE(str(?p),CONCAT("SDN:",?vocab,"::"),"","i") AS ?prpreflabel) .
    BIND(REPLACE(str(?o),CONCAT("SDN:",?vocab,"::"),"","i") AS ?obpreflabel) .
    }

As a URL returing JSON:
http://vocab.nerc.ac.uk/sparql/sparql?query=PREFIX+dct%3A+%3Chttp%3A%2F%2Fpurl.org%2Fdc%2Fterms%2F%3E%0D%0APREFIX+skos%3A+%3Chttp%3A%2F%2Fwww.w3.org%2F2004%2F02%2Fskos%2Fcore%23%3E%0D%0APREFIX+owl%3A+%3Chttp%3A%2F%2Fwww.w3.org%2F2002%2F07%2Fowl%23%3E%0D%0A%0D%0Aselect+%3Fvocab+%3Fprpreflabel+%3Fobpreflabel%0D%0Awhere+%7B%0D%0A++++%3Fb+%3Chttp%3A%2F%2Fpurl.org%2Fdc%2Fterms%2FisReplacedBy%3E+%3Fc+.%0D%0A++++%3Fa+skos%3Amember+%3Fb+.%0D%0A++++%3Fa+skos%3Amember+%3Fc+.%0D%0A++++%3Fb+skos%3AprefLabel+%3Fp+.%0D%0A++++%3Fc+skos%3AprefLabel+%3Fo+.%0D%0A++++FILTER%28CONTAINS%28str%28%3Fa%29%2C%22http%3A%2F%2Fvocab.nerc.ac.uk%2Fcollection%2FP07%2Fcurrent%2F%22%29%29+.%0D%0A++++BIND%28REPLACE%28REPLACE%28str%28%3Fa%29%2C%22http%3A%2F%2Fvocab.nerc.ac.uk%2Fcollection%2F%22%2C%22%22%2C%22i%22%29%2C%22%2Fcurrent%2F%22%2C%22%22%2C%22i%22%29+AS+%3Fvocab%29+.%0D%0A++++BIND%28REPLACE%28str%28%3Fp%29%2CCONCAT%28%22SDN%3A%22%2C%3Fvocab%2C%22%3A%3A%22%29%2C%22%22%2C%22i%22%29+AS+%3Fprpreflabel%29+.%0D%0A++++BIND%28REPLACE%28str%28%3Fo%29%2CCONCAT%28%22SDN%3A%22%2C%3Fvocab%2C%22%3A%3A%22%29%2C%22%22%2C%22i%22%29+AS+%3Fobpreflabel%29+.%0D%0A++++%7D&output=json&stylesheet=

