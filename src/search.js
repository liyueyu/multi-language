const fs = require('fs');
const path = require('path');
const async = require('async');
const utils = require('./utils.js');
const SearchChinese = require('./searchChinese.js');

/**
 * 文件遍历
 * @param filePath 需要遍历的文件
 * @param fileArr
 * @returns {Promise<Array>}
 */
function fileDisplay (filePath, exclude, fileArr = []) {
    return new Promise((resolve, reject) => {
        if (exclude.indexOf(filePath) > -1) {
            console.log('查找排除文件:', filePath)
            return resolve(fileArr)
        }
        //根据文件路径获取文件信息，返回一个fs.Stats对象
        fs.stat(filePath, function (error, stats) {
            if (error) {
                reject('获取文件stats失败', error)
            } else {
                const isFile = stats.isFile(); //是文件
                const isDir = stats.isDirectory(); //是文件夹
                if (isFile) {
                    fileArr.push(filePath);
                    resolve(fileArr)
                }
                if (isDir) { // 如果是文件夹，就继续遍历该文件夹下面的文件
                    //根据文件路径读取文件，返回文件列表
                    fs.readdir(filePath, function (err, files) {
                        if (err) {
                            reject('读取文件目录失败', err)
                        } else {
                            
                            //遍历读取到的文件列表
                            const arr = files.map(function (filename) {
                                //获取当前文件的绝对路径
                                const fileDir = path.join(filePath, filename);
                                return fileDisplay(fileDir, exclude) //递归
                            });
                            Promise.all(arr).then((...dirs) => {
                                fileArr = [].concat(...fileArr.concat(...dirs));
                                resolve(fileArr)
                            })
                        }
                    });
                }
            }
        })
    })
}

/**
 * 获取查找结果
 * @param searchDir
 * @returns {Promise<any>}
 */
const getSearchResult = (searchDir, exclude) => {
    const searchChinese = new SearchChinese();
    
    
    return new Promise((resolve, reject) => {
        console.log('查找的dir:', searchDir);
        fileDisplay(searchDir, exclude).then((fileDir) => {
            console.log('找到文件数量:', fileDir.length);
            let count = 0
            async.each(fileDir, function (file, callback) {
                let isVUE = /\.vue$/.test(file);
                let isJS = /\.(jsx?|ts)$/.test(file);
                let isHTML = /\.html$/.test(file);
                utils.readFile(file).then(data => {
                    if (isVUE) {
                        const scriptReg = /(?<=<script>)(\s|\S)+(?=<\/script>)/g;
                        const templateReg = /(?<=<template>)(\s|\S)+(?=<\/template>)/g;
                        const styleReg = /(?<=<style)(\s|\S)+(?=<\/style>)/g;
                        
                        let template = templateReg.exec(data);
                        let script = scriptReg.exec(data);
                        let style = styleReg.exec(data);
                        template && searchChinese.searchInTemplate(file, template[0], template.index);
                        script && searchChinese.searchInScript(file, script[0], script.index);
                        style && searchChinese.searchInStyle(file, style[0], style.index)
                    } else if (isJS) {
                        searchChinese.searchInScript(file, data)
                    } else if (isHTML) {
                        // searchChinese.searchInHTML(file, data)
                    }
                    count++
                    callback()
                }).catch(e => callback(e))
            }, function (err) {
                if (err) {
                    console.log('A file failed to process');
                    reject(err)
                } else {
                    console.log('查找文件数', count);
                    const result = searchChinese.getResult();
                    resolve(result)
                }
            })
        })
    })
};

module.exports = getSearchResult