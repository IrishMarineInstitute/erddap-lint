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

# ISO 8601 Date Time Formats
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
