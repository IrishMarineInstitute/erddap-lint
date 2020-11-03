# Global URL Rules

Rules testing urls provided in metadata.

# Accepted Datasets

Any dataset having an NC_GLOBAL attributes name ending with "url".

```javascript
(dataset)=>{
    memo.global_url_rules = memo.global_url_rules || {
        get_nc_global_url_names:  function(ds){
            return Object.keys(ds.NC_GLOBALS.attributes).filter(k=>k.toLowerCase().endsWith("url"));
        },
        get_url_variables: function(ds){
            return ds.variables.filter(v=>v.name.toLowerCase().endsWith("url"))
        },
        get_url_map: function(ds){
            let map = {};
            memo.global_url_rules.get_nc_global_url_names(ds).forEach(attr=>{
                map[`NC_GLOBAL.${attr}`] = ds.NC_GLOBALS.attributes[attr];
            })
            memo.global_url_rules.get_url_variables(ds).forEach(v=>{
                map[`Variable ${v.name}`] = v;
            });
            return map;
        }
    }
    if(memo.global_url_rules.get_nc_global_url_names(dataset).length > 0){
        return true;
    }
    if(memo.global_url_rules.get_url_variables(dataset).length > 0){
        return true;
    }
    return false;
}
```

# All URLs must be syntatically valid

```javascript
(dataset)=>{
    let isValidUrl = function(url){
        try{
            new URL(url);
            return true;
        }catch(e){
            return false;
        }
    }
    let invalid = [];
    let map = memo.global_url_rules.get_url_map(dataset);
    Object.keys(map).forEach(k=>{
        let v = map[k].value;
        if(!isValidUrl(v)){
            invalid.push(`${k} invalid url "${v}"`)
        }
    })
    if(invalid.length){
        chai.assert.fail(invalid.join("\n             "));
    }
    return true;
}
