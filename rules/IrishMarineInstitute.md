# Some rules specific to [Irish Marine Institute](https://www.marine.ie/)

# Accepted Datasets
Just the ones at marine.ie for now

```javascript
(dataset)=>dataset.url.indexOf("marine.ie/")>=0;
```

# infoUrl must link to data.marine.ie

```javascript
(NC_GLOBAL)=>NC_GLOBAL.attributes.infoUrl && NC_GLOBAL.attributes.infoUrl.value.indexOf('data.marine.ie')>=0;
```
