# Marine Institute Rules

Some rules specific to [Irish Marine Institute](https://www.marine.ie/)

# Accepted Datasets
Just the ones at marine.ie for now

```javascript
(dataset)=>dataset.url.indexOf("marine.ie/")>=0;
```

# Must Link to a data catalogue record, but doesn't
The infoUrl must link to a catalogue record at data.marine.ie

```javascript
(NC_GLOBALS)=>NC_GLOBALS.infoUrl && NC_GLOBALS.infoUrl.value.indexOf('data.marine.ie')>=0;
```

# Institution should be "Marine Institute, Ireland", but isn't

Where the institution name is like `Marine Institute` it must read `Marine Institute, Ireland`
```javascript
(NC_GLOBALS)=>{
  if(!NC_GLOBALS.attributes.institution){
    return false; //needs to be here.
  }
  let institution = NC_GLOBALS.attributes.institution.value;
  if(institution.toLowerCase().indexOf("marine institute")>=0){
    return institution === "Marine Institute, Ireland";
  }
  return true;
}

```

# ISO 8601 Date Time Formats
All dates/times in ERDDAP dataset titles or abstracts must follow ISO 8601 Date & Time format
