# Global Time Rules

Rules for all datasets having a time variable or dimension.

# Accepted Datasets


```javascript
(dataset)=>dataset.variables.concat(dataset.dimensions).filter(v=>v.name==="time").length;
```


# Year range in the dataset title is helpful

Have a year range in the dataset's title (e.g., "2007-2015"). with "present" used for ongoing datasets (e.g., "2007-present"). That is very useful information for a user.

```javascript
(NC_GLOBALS)=>{
    if(!NC_GLOBALS.attributes.time_coverage_start){
        let title = NC_GLOBALS.attributes.title.value;
        if(title.match(/\b\d{4}\b/)){
            return true;
        }
        chai.assert.fail("NC_GLOBAL.title should show year range");
    }
    let time_coverage_start = new Date(NC_GLOBALS.attributes.time_coverage_start.value);
    // skip if less than 180 days ago.
    if(new Date().getTime() - time_coverage_start.getTime() < 180*60*60*1000){
        return true;
    }
    let expect_any = [time_coverage_start.getFullYear(),`${time_coverage_start.getFullYear()}-present`];
    if(NC_GLOBALS.attributes.time_coverage_end){
        let time_coverage_end = new Date(NC_GLOBALS.attributes.time_coverage_end.value);
        if(time_coverage_end.getFullYear() !== time_coverage_start.getFullYear()){
            expect_any = [`${time_coverage_start.getFullYear()}-${time_coverage_end.getFullYear()}`];
            if(new Date().getTime() - time_coverage_start.getTime() < 365*60*60*1000){
                expect_any.push(`${time_coverage_start.getFullYear()}-present`)
            }
        }
    }
    let title = NC_GLOBALS.attributes.title.value.toLowerCase().replace(/\s+/g,"");
    let ok = expect_any.filter(y=>title.indexOf(y)>=0).length;
    if(ok){
        return true;
    }
    chai.assert.fail(`NC_GLOBAL.title should show year range eg: ${expect_any.join(" or ")}`);
}
```

# Time coverage start attribute is present

```javascript
(NC_GLOBALS)=>{
    let missing = [];
    ["time_coverage_start"].forEach(attr=>{
        if(!NC_GLOBALS.attributes[attr]){
             missing.push(`NC_GLOBAL.${attr}`);
        }
    })
    if(missing.length){
        chai.assert.fail(`Missing: ${missing.join(", ")}`);
    }
    return true;
}
```