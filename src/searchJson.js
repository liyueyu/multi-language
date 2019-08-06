const fs = require('fs');
const getSearchResult = require('./search.js');
const config = require('../config.js');

const {projectName, searchDir, outputDir, searchFileName} = config

const searchJsonFileName = `${outputDir}/${projectName}${searchFileName}`

/**
 * 获取查找结果导出json
 */
getSearchResult(searchDir).then(result => {
    const filterCommit = result.filter(({isCommit}) => !isCommit);
    const commit = result.filter(({isCommit}) => isCommit);
    const js = filterCommit.filter(({type}) => type === 'js');
    const template = filterCommit.filter(({type}) => type === 'template');
    const style = filterCommit.filter(({type}) => type === 'style');
    
    console.log(`
                总计:${result.length}
                js: ${js.length}
                template: ${template.length}
                commit: ${commit.length}
                style: ${style.length}
                filterCommit: ${filterCommit.length}
            `)
    
    
    fs.writeFile(searchJsonFileName, JSON.stringify(filterCommit), 'utf8', (err) => {
        if (err) throw err;
        console.log(`${searchJsonFileName} 文件已被保存`);
    });
});