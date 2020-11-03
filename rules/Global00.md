# Global Rules 00

# All creator_* attributes are provided

These NC_GLOBAL attributes belong to all datasets:

    * creator_name
    * creator_email
    * creator_type
    * creator_url

```javascript
(NC_GLOBALS)=>{
    let missing = [];
    let must = ["creator_name","creator_email","creator_type","creator_url"];
    must.forEach(v=>{
        if(! (NC_GLOBALS.attributes[v] && NC_GLOBALS.attributes[v].value)){
            missing.push(`NC_GLOBAL.${v}`);
        }
    });
    if(missing.length === 0){
        return true;
    }
    chai.assert.fail(`Missing ${missing.join(", ")}`);

}
```

