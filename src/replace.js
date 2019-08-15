const fs = require('fs');
const config = require('../config.js');
const utils = require('./utils.js');

const {projectName, searchDir, outputDir, exportFileName, searchFileName} = config;

const exportJsonFileName = `${outputDir}/${projectName}${exportFileName}`;

const searchJsonFileName = `${outputDir}/${projectName}${searchFileName}`

const getCnJson = () => {
    return utils.readFile(exportJsonFileName).then(result => {
        try {
            const cnJson = JSON.parse(result)
            let map = {}
            for (var key in cnJson) {
                map[cnJson[key]] = key
            }
            
            return map
        } catch (e) {
            console.error('json解析错误')
        }
    });
}

const getFilterSearchResult = () => {
    return utils.readFile(searchJsonFileName).then(result => {
        try {
            const json = JSON.parse(result)
            return json
        } catch (e) {
            console.error('json解析错误')
        }
    });
}

const replaceFile = (file, map, arr) => {
    return utils.readFile(file).then(fileStr => {
        let exclude = []
        let include = []
        
        const checkIndex = (index) => {
            return include.every(({index: [s, e]}) => s > index[1] || e < index[0])
        }
        
        /**
         * 替换文本
         * @param path
         * @param content
         * @param type
         * @param isTemplateJs
         * @param isAttribute
         * @param jsGrammar
         * @param index
         * @param paragraph
         * @param paragraphIndex
         * @param isReplaceParagraph
         * @param match
         * @param map
         * @returns {{afterPlace: *, replace: *, beforePlace: *}}
         */
        const replaceStr = ({path, content, type, isTemplateJs, isAttribute, jsGrammar, index, paragraph, paragraphIndex, isReplaceParagraph, match, attributeKey}, map) => {
            let beforePlace = 0, replace, afterPlace = 0;
            
            const isVUE = /\.vue$/.test(path);
            const es6StringGrammar = jsGrammar === '`';
            const isIndexMatchParagraphIndex = !paragraph || (index[0] === paragraphIndex[0] && index[1] === paragraphIndex[1])
    
            let beforeChar = '', afterChar = ''
            if (!isIndexMatchParagraphIndex) {
                beforeChar = paragraph.slice(0, index[0] - paragraphIndex[0])
                afterChar = paragraph.slice(index[1] - paragraphIndex[0], paragraphIndex[1] - paragraphIndex[0])
            }
            
            const add = (before = '', content = '', after = '') => {
                return `${before}${content}${after}`
            };
            
            let params = `('${map[content]}')`
    
            /**
             * 替换了文本的情况下
             * 添加记录的参数
             */
            if (isReplaceParagraph) {
                params += `, [${match.join(', ')}]`
            }
    
            /**
             * js语法环境
             */
            if (jsGrammar && (type === 'js' || (type === 'template' && isTemplateJs))) {
                if (type === 'js') {
                    if (isVUE) {
                        replace = add('this.$t', params)
                    } else {
                        replace = add('i18n.tc', params)
                    }
                } else {
                    replace = add('$t', params)
                }
                /**
                 * js字符串引号处理
                 */
                if (isIndexMatchParagraphIndex) {
                    beforePlace = 1
                    afterPlace = 1
                } else {
                    replace = add('\${', replace, '}')
                    if (!es6StringGrammar) {
                        replace = `\`${beforeChar}${replace}${afterChar}\``
                        beforePlace = 1 + beforeChar.length
                        afterPlace = 1 + afterChar.length
                    }
                }
            } else if (type === 'template') {
                if (!isAttribute) {
                    replace = add('{{$t', params, '}}')
                } else if (attributeKey) {
                    if (isIndexMatchParagraphIndex) {
                        replace = add(`:${attributeKey}="$t`, params, '"')
                    }else {
                        replace = add(`:${attributeKey}="\`${beforeChar}\${$t`, params, `}${afterChar}\`"`)
                    }
                    beforePlace = attributeKey.length + 2 + beforeChar.length
                    afterPlace = afterChar.length + 1
                }
            }
            
            if (replace) {
                return {
                    beforePlace,
                    replace,
                    afterPlace
                }
            }
        }
        
        arr.forEach((data) => {
            if (map[data.content] && checkIndex(data.index) && replaceStr(data, map)) {
                include.push(data)
            } else {
                exclude.push(data)
            }
        })
        
        include.sort(function (a, b) {
            return a.index[0] - b.index[1]
        })
        
        
        let str = ''
        let includeLen = include.length
        let fileLen = fileStr.length
        
        let lastStart = 0
        include.forEach((data, index) => {
            const [beforeIndex, afterIndex] = data.index
            const {beforePlace, replace, afterPlace} = replaceStr(data, map)
            
            str += fileStr.substring(lastStart, beforeIndex - beforePlace)
            str += replace
            lastStart = afterIndex + afterPlace
            if (index === includeLen - 1) {
                str += fileStr.substring(lastStart, fileLen)
            }
        })
        
        if (includeLen > 0) {
            const isJs = /\.js$/.test(file)
            
            const importStr = `import { i18n } from 'src/lang'`
            /**
             * js 文件头部添加 `import { i18n } from 'src/lang'`
             */
            if (isJs && str.indexOf(importStr) === -1) {
                str = `${importStr}\n${str}`
            }
            
            // console.log(arr.length, includeLen)
            // console.log(include);
            // console.log(exclude.length)
            
            // console.log(str)
            fs.writeFile(file, str , 'utf8',  (err) => {
                if (err) throw err;
                console.log(`
                文件${file}
                已替换 ${includeLen} 条数据
                未替换数据: ${exclude.length}
                `);
            });
        }
    })
}

const init = async () => {
    const map = await getCnJson()
    const searchResult = await getFilterSearchResult(searchDir)
    
    const addressMap = searchResult.reduce((memeroy, data) => {
        if (!memeroy[data.path]) {
            memeroy[data.path] = []
        }
        memeroy[data.path].push(data)
        return memeroy
    }, {})
    
    for (let dir in addressMap) {
        replaceFile(dir, map, addressMap[dir])
    }
}




init()