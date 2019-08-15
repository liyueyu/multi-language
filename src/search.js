const fs = require('fs');
const path = require('path');
const async = require('async');
const utils = require('./utils.js');

/**
 * 文件遍历
 * @param filePath 需要遍历的文件
 * @param fileArr
 * @returns {Promise<Array>}
 */
function fileDisplay(filePath, exclude, fileArr = []) {
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
 * 查找中文
 */
class SearchChinese {
    constructor() {
        this.result = []
        this.initReg()
        console.log(this.reg)
    }
    
    get type () {
        return {
            TEMPLATE: 'template',
            HTML: 'html',
            JS: 'js',
            STYLE: 'style'
        }
    }
    
    /**
     * 查找中文汉字
     * ${chineseChar}(${chineseChar}|${punctuation}|\\s)*${chineseChar}  汉字中间是空白或者是标点的情况
     * ${chineseChar}+ 连续汉字
     */
    initReg () {
        const han = '[\\u4e00-\\u9fa5]'
        const symbol = '[。；，：“”（）、？《》,./]'
        this.reg = new RegExp(`${han}(${han}|${symbol}|\\s)*${han}|${han}+`, 'g')
    }
    
    addResult (arr) {
        this.result.push(...arr)
    }
    
    getResult () {
        return this.result
    }
    
    clearResult () {
        this.result = []
    }

    searchInTemplate(filePath, str, frontIndex = 0) {
        this._search(filePath, str, frontIndex, this.type.TEMPLATE)
    }

    searchInHTML(filePath, str, frontIndex = 0) {
        this._search(filePath, str, frontIndex, this.type.HTML)
    }
    
    searchInStyle(filePath, str, frontIndex = 0) {
        this._search(filePath, str, frontIndex, this.type.STYLE)
    }

    searchInScript(filePath, str, frontIndex = 0) {
        this._search(filePath, str, frontIndex, this.type.JS)
    }

    _search (filePath, str, frontIndex, type) {
        if (Array.isArray(str)) {
            str.forEach(s => {
                this.search(filePath, s, frontIndex, type)
            })
        } else if (typeof str === 'string') {
            this.search(filePath, str, frontIndex, type)
        }
    }
    
    /**
     * 查找中文基础信息
     * @param filePath
     * @param str
     * @param frontIndex
     * @param type
     * @private
     */
    _searchBaseChinese (filePath, str, frontIndex, type) {
        let result = [];
        let reg = this.reg;
        let m;
        while ((m = reg.exec(str)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === reg.lastIndex) {
                reg.lastIndex++;
            }
            result.push({
                content: m[0],
                type: type,
                path: filePath,
                index: [m.index, reg.lastIndex],
                frontIndex: frontIndex
            })
        }
        return this._getMoreInfo (str, result, type)
    }
    
    _getMoreInfo (str, baseArr, type) {
    
        const getNoChar = (char) => {
            return `((?!${char})(\\S|\\s))*`
        }
        
        /**
         * 注释判断
         * @param before
         * @param after
         * @returns {boolean}
         */
        const isCommitTest = (before, after) => {
            if (type === this.type.TEMPLATE || type === this.type.HTML) {
                return /<!--((?!-->)(\S|\s))*$/g.test(before) && /^((?!<!--)(\S|\s))*-->/g.test(after)
            } else if (type === this.type.JS || type === this.type.STYLE) {
                return /\/\/([ \t]|\S)*$/g.test(before) || (/\/\*((?!\*\/)(\S|\s))*$/g.test(before) && /^((?!\/\*)(\S|\s))*\*\//g.test(after))
            }
        };
    
        /**
         * 模板属性判读
         * @param before
         * @param after
         * @returns {boolean}
         */
        const isAttributeTest = (before, after) => {
            if (type === this.type.TEMPLATE || type === this.type.HTML) {
                return/<((?!>)(\S|\s))+=\s*"((?!")(\S|\s))*$/g.test(before) && /^((?!<)(\S|\s))+>/g.test(after)
            }
            return false
        };
    
        /**
         * 查找模板内容是否是js环境
         * @param before
         * @param after
         * @returns {boolean}
         */
        const isTemplateJsTest = (before, after) => {
            if (type === this.type.TEMPLATE) {
                const isAttribute = isAttributeTest(before, after)
                if (isAttribute) {
                    return /:\S+="((?!")(\S|\s))*$/g.test(before)
                } else {
                    return /{{((?!}})(\S|\s))*$/g.test(before) && /^((?!{{)(\S|\s))*}}/g.test(after)
                }
            }
            return false
        };
    
        /**
         * 查找所在的连贯语句
         * js以 ' " ` 分割
         * @param content
         * @param before
         * @param after
         * @returns {*}
         */
        const getParagraph = ( before, after, isTemplate = false) => {
            if (isTemplate) {
                /**
                 * 获取>和<中间的内容
                 */
                const beforeReg = /(?<=>)((?!>)(\S|\s))*$/g
                const afterReg = /^(\S|\s)*?(?=<)/g
                const beforeMatch = before.match(beforeReg)
                const afterMatch = after.match(afterReg)
                let beforeChar = beforeMatch? beforeMatch[0]: ''
                let afterChar = afterMatch? afterMatch[0] : ''
                // 去除无效空格和&nbsp;
                beforeChar = beforeChar.replace(/^(\s|&nbsp;)+/g, '')
                afterChar = afterChar.replace(/(\s|&nbsp;)+$/g, '')
                return {
                    beforeChar,
                    afterChar
                }
            } else {
                /**
                 * 排除\'\"\`后的'"`
                 * @type {string}
                 */
                const grammar = '((?<!\\\\)`|(?<!\\\\)"|(?<!\\\\)\')'
                
                const beforeReg = new RegExp(`${grammar}${getNoChar(grammar)}$`, 'g')
                let beforeMatch = before.match(beforeReg)
                if (beforeMatch) {
                    const beforeSign = beforeMatch[0][0]
                    let beforeChar = beforeMatch[0].slice(1)
                    
                    const singGrammar = `(?<!\\\\)${beforeSign}`
                    const afterReg = new RegExp(`^${getNoChar(singGrammar)}(?=${singGrammar})`, 'g')
                    
                    const afterMatch = after.match(afterReg)
                    
                    let afterChar = afterMatch? afterMatch[0] : ''
                    beforeChar = beforeChar.replace(/^(\s|&nbsp;)+/g, '')
                    afterChar = afterChar.replace(/(\s|&nbsp;)+$/g, '')
                    return {
                        beforeChar,
                        afterChar,
                        jsGrammar: beforeSign
                    }
                }
            }
            return false
        };
    
        /**
         * 替换paragraph数据中的变量为{index}格式
         * @param type
         * @param isAttribute
         * @param paragraph
         * @returns {*}
         */
        const replaceParagraph = ({type, isAttribute, isTemplateJs, paragraph}) => {
            let replaceStr = paragraph
            let isReplaceParagraph = false
            let match = []
            let reg =null
            if (type === this.type.TEMPLATE && !isAttribute) {
                reg = /{{((\s|\S)+?)}}/
            }
            
            if (type === this.type.JS || isTemplateJs) {
                reg = /\${((\s|\S)+?)}/
            }
            
            
            if (reg) {
                let index = 0
                while (reg.test(replaceStr)) {
                    isReplaceParagraph = true
                    replaceStr = replaceStr.replace(reg, (m, p1) => {
                        match.push(p1)
                        return `{${index}}`
                    })
                    index++
                }
            }
            return {
                isReplaceParagraph,
                replaceStr,
                match
            }
        }
        
        let moreInfoArr = baseArr.map((info) => {
            const {content, index} = info;
            const [startIndex, endIndex] = index
            
            const before = str.slice(0, startIndex);
            const after = str.slice(endIndex);
            
            const dataIndex = [startIndex + info.frontIndex, endIndex + info.frontIndex]
    
            const isCommit = isCommitTest(before, after)
            const isAttribute = isAttributeTest(before, after)
            const isTemplate = type === this.type.TEMPLATE || type === this.type.HTML
            const isTemplateJs = type === this.type.TEMPLATE && isTemplateJsTest(before, after)
            
            if (!isCommit) {
                const paragraphInfo = getParagraph(before, after, isTemplate && !isTemplateJs &&  !isAttribute)
                if (paragraphInfo) {
                    const {beforeChar, afterChar, jsGrammar} = paragraphInfo
                    /**
                     * paragraph 和content不一致时
                     * 额外记录paragraph和paragraphIndex
                     */
                    if (beforeChar || afterChar) {
                        const paragraph = beforeChar + content + afterChar
                        const paragraphIndex = [dataIndex[0] - beforeChar.length, dataIndex[1]  + afterChar.length]
                        return {
                            ...info,
                            index: dataIndex,
                            paragraph,
                            paragraphIndex,
                            isCommit,
                            isTemplateJs,
                            isAttribute,
                            jsGrammar
                        }
                    } else {
                        return {
                            ...info,
                            index: dataIndex,
                            isCommit,
                            isTemplateJs,
                            isAttribute,
                            jsGrammar
                        }
                    }
                }
            }
            
            return {
                ...info,
                index: dataIndex,
                isCommit,
                isTemplateJs,
                isAttribute
            }
        });
    
        /**
         * 合并相同paragraph
         * 替换相邻info中的变量
         */
        moreInfoArr = moreInfoArr.reduce((memory, info) => {
            const last = memory[memory.length - 1] || {}
            if (last.paragraph && last.paragraph === info.paragraph) {
                const {
                    isReplaceParagraph,
                    replaceStr,
                    match
                } = replaceParagraph(info)
                if (isReplaceParagraph) {
                    memory[memory.length - 1] = {
                        ...last,
                        content: replaceStr,
                        isReplaceParagraph,
                        match,
                        index: info.paragraphIndex
                    }
                } else {
                    memory[memory.length - 1] = {
                        ...last,
                        content: replaceStr,
                        index: info.paragraphIndex
                    }
                }
                
            } else {
                memory.push(info)
            }
            return memory
        },[]);
        // console.log(moreInfoArr)
        
        return moreInfoArr
    }

    search (...arg) {
        const result = this._searchBaseChinese(...arg);
        this.addResult(result)
    }
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
                let isJS = /\.js$/.test(file);
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