const fs = require('fs');
const config = require('../config.js');
const utils = require('./utils.js');

const {projectName, exportFileName, outputDir, searchFileName, replaceExportFile} = config

const searchJsonFileName = `${outputDir}/${projectName}${searchFileName}`

const exportJsonFileName = `${outputDir}/${projectName}${exportFileName}`

const getExportJson = (exportJsonFileName) => {
    return new Promise( (resolve, reject) => {
        fs.stat(exportJsonFileName, async function (error, stats) {
            if (error) {
                resolve({})
            } else {
                const exportJson = await utils.getJson(exportJsonFileName)
                resolve(exportJson)
            }
        })
    })
}

const init = async () => {
    const searchJson = await utils.getJson(searchJsonFileName)
    
    let lastExportJson = {}
    let lastExportJsonMap = {}
    if (replaceExportFile) {
        lastExportJson = await getExportJson(exportJsonFileName)
        Object.keys(lastExportJson).forEach((key) => {
            lastExportJsonMap[lastExportJson[key]] = key
        })
    }
    
    let num = 0
    const addContent = (content) => {
        let key = utils.num2key(num)
        while (key in lastExportJson) {
            num++
            key = utils.num2key(num)
        }
        lastExportJson[key] = content
        lastExportJsonMap[content] = key
        return key
    }
    
    let addKeys = []
    searchJson.forEach(({content}) => {
        if (!(content in lastExportJsonMap)) {
            const key = addContent(content)
            addKeys.push(key)
        }
    })
    
    fs.writeFile(exportJsonFileName, JSON.stringify(lastExportJson), 'utf8', (err) => {
        if (err) throw err;
        console.log(`
            ${exportJsonFileName} 文件已被保存
            生成JSON ${Object.keys(lastExportJson).length} 条
            新增key为 ${addKeys.length} 条
            ${addKeys}`)
    });
}

init ()
