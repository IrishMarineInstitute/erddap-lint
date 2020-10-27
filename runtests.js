const Mocha = require('mocha');
const fs = require('fs');
const path = require('path');
global.fetch = require("node-fetch");
global.chai = require('chai');

/*
const mocha = new Mocha({
  ui: 'bdd',
  reporter: 'mochawesome',
  reporterOptions: {
    reportFilename: 'adam',
    timestamp: 'dd yyyy',
  },
});
*/

const ErddapLint = require("./js/erddap-lint.js");


const rulesDir = path.resolve(__dirname, 'rules');
let lint = new ErddapLint();

// Add each .js file to the mocha instance
fs.readdirSync(rulesDir)
  // .filter(file => file.substr(-3) === '.js')
  .filter(file => file.endsWith('.md'))
  .forEach(file => {
    let filePath = path.join(rulesDir, file);
    let markdown = fs.readFileSync(filePath, "utf8");
    lint.addRuleSetFromMarkdown(rulesDir, markdown);
  });
let params = {
  erddap: process.env.erddap || "https://erddap.marine.ie/erddap/"
}
describe("load erddap-lint tests", function(){
  this.timeout(30000)
  it("should prepare mocha tests for ERDDAP", function(done){
  lint.prepareMochaTestsForErddap(params.erddap,y=>console.log(y))
    .then(e => {
      done();// other tests will follow
    })
  })
});
/*
    mocha.run(failures => {
      process.on('exit', () => {
        process.exit(failures); // exit with non-zero status if there were failures
      });
    });
*/