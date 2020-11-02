# erddap-lint
A lint tool for Erddap dataset configurations. [Demo](https://irishmarineinstitute.github.io/erddap-lint/)

This project contains rules and a simple static web application for running some verification tests against your ERDDAP server. All the tests are run in the web browser.

This is a new project; you're welcome to follow along but things may change suddenly and quickly. (We'll remove this statement when things become more stable!)

# The Rules
To add your own rules, see [How To Write Rules](WritingRules.md), then add your rules file into the [rules](rules/) folder, and list it into [rules/index.html](rules/index.html).

# Docker

```
docker build -t erddap-lint .
mkdir output
docker run --rm -v $(pwd)/output:/output erddap-lint https://erddap.digitalocean.ie/erddap/
```

The report will be in the output folder
