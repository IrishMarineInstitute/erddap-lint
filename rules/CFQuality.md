# CF Quality Rules

# Accepted Datasets

Accept any dataset with ioos_category=Quality

```javascript
(dataset)=>{
    memo.cf_quality_rules = memo.cf_quality_rules || {
        quality_variables : function(ds){
            return ds.variables.filter(v=>v.attributes.ioos_category)
                    .filter(v=>v.attributes.ioos_category.value.toLowerCase() === "quality");
        }
    }
    return memo.cf_quality_rules.quality_variables(dataset).length > 0;
}
```

# Recognised Standard Name

standard_name attribute must end with 'status_flag' or 'quality_flag'

```javascript
(dataset)=>{
    let standard_name_endings = ['status_flag', 'quality_flag'];
    let qvars = memo.cf_quality_rules.quality_variables(dataset);
    let messages = [];
    qvars.forEach(qvar=>{
        if(!qvar.attributes.standard_name){
            messages.push(`Missing standard_name attribute for variable ${qvar.name}`);
            return;
        }
        let standard_name = qvar.attributes.standard_name.value;
        for(let i=0; i<standard_name_endings.length; i++){
            if(standard_name.endsWith(standard_name_endings[i])){
                return;
            }
        }
        messages.push(`Unexpected ${qvar.name}.standard_name="${standard_name}", `
                    +`(expected something like ${standard_name_endings.join(" or ")})`)
    })

    if(messages.length){
        chai.assert.fail(messages.join("\n                "));
    }
    return true;
}
```

# Consistent Flag Range/Value/Meaning

If present the attributes valid_range, flag_values, flag_meanings must contain equal number of items.

```javascript
(dataset)=>{
    let attr_names = ["valid_range", "flag_values", "flag_meanings"];
    let qvars = memo.cf_quality_rules.quality_variables(dataset);
    let messages = [];
    qvars.forEach(qvar=>{
        let map = attr_names.reduce((m, k)=>{ m[k] = 0; return m}, {});
        attr_names.forEach(attr=>{
            if(qvar.attributes[attr]){
                let v = qvar.attributes[attr].value;
                if(v.match(/^["'`]/)){
                    messages.push(`${qvar.name}.${attr} is in quotations: ${v}`)
                }
                let nparts = v.trim().replace(/[,;]/g, " ").split(/\s+/).length;
                map[attr] = nparts;
            }

        });
        if(map.flag_values && !map.flag_meanings){
            messages.push(`${qvar.name}.flag_values is set, but not ${qvar.name}.flag_meanings`);
            return;
        }
        if(map.flag_meanings && !map.flag_values){
            messages.push(`${qvar.name}.flag_meanings is set, but not ${qvar.name}.flag_values`);
            return;
        }
        if(map.flag_values !== map.flag_meanings){
            messages.push(`${qvar.name}.flag_meanings has ${map.flag_meanings} values but ${qvar.name}.flag_values has ${map.flag_values}`);
        }
        if(map.valid_range && map.valid_range !== map.flag_values){
           messages.push(`${qvar.name}.valid_range has ${map.valid_range} values but ${qvar.name}.flag_values has ${map.flag_values}`);
        }
    });

    if(messages.length){
        chai.assert.fail(messages.join("\n                "));
    }
    return true;

}
```