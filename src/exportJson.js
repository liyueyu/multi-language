const fs = require('fs');
const config = require('../config.js');
const utils = require('./utils.js');

const {projectName, exportFileName, outputDir, searchFileName} = config

const searchJsonFileName = `${outputDir}/${projectName}${searchFileName}`

const exportJsonFileName = `${outputDir}/${projectName}${exportFileName}`


utils.readFile(searchJsonFileName).then(result => {
    
    try {
        const searchJson = JSON.parse(result)
        
        let num = 0
        const contentMap = searchJson.reduce((memory, {content}) => {
            if (!memory[content]) {
                memory[content] = num
                num++
            }
            return memory
        }, {});

        let json = {}
        for (let content in contentMap) {
            let num = contentMap[content]
            json[utils.num2key(num)] = content
        }
        
        fs.writeFile(exportJsonFileName, JSON.stringify(json) , 'utf8',  (err) => {
            if (err) throw err;
            console.log(`
            生成JSON ${Object.keys(json).length} 条
            ${exportJsonFileName} 文件已被保存`);
        });
    } catch (e) {
        console.error('json解析错误')
    }
});