# Some rules specific to [Irish Marine Institute](https://www.marine.ie/)

# Accepted Datasets
Just the ones at marine.ie for now

```javascript
(dataset)=>dataset.url.indexOf("marine.ie/")>=0;
```

# Link to a data catalogue record
The infoUrl must link to a catalogue record at data.marine.ie

```javascript
(NC_GLOBAL)=>NC_GLOBAL.attributes.infoUrl && NC_GLOBAL.attributes.infoUrl.value.indexOf('data.marine.ie')>=0;
```

# Institution is "Marine Institute, Ireland"

Where the institution name is like `Marine Institute` it must read `Marine Institute, Ireland`
```javascript
function(NC_GLOBAL){
  if(!NC_GLOBAL.attributes.institution){
    return false; //needs to be here.
  }
  let institution = NC_GLOBAL.attributes.institution.value;
  if(institution.toLowerCase.indexOf("marine institute")>=0){
    return institution === "Marine Institute, Ireland";
  }
  return true;
}

```

# ISO 6801 Date Time Formats
All dates/times in ERDDAP dataset titles or abstracts must follow ISO 6801 Date & Time format
