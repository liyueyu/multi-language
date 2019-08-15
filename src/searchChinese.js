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
         * 模板属性key查找
         * 需要满足格式 key="xx"
         * @param before
         * @param after
         * @returns {*}
         */
        const getAttributeKey = (before, after) => {
            const attributeKey = before.match(/\S+(?==\s*"((?!")(\S|\s))*$)/g)
            return attributeKey ? attributeKey[0] : undefined
        }
        
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
            const isTemplateJs = isTemplateJsTest(before, after)
            
            let moreInfo = {
                index: dataIndex,
                isCommit,
                isTemplateJs,
                isAttribute,
            }
            
            if (!isCommit) {
                if (isTemplate && isAttribute && !isTemplateJs) {
                    const attributeKey = getAttributeKey(before, after)
                    moreInfo = {
                        ...moreInfo,
                        attributeKey
                    }
                }
                
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
                        moreInfo = {
                            ...moreInfo,
                            paragraph,
                            paragraphIndex,
                            jsGrammar
                        }
                        
                    } else {
                        moreInfo = {
                            ...moreInfo,
                            jsGrammar
                        }
                    }
                }
            }
            
            return {
                ...info,
                ...moreInfo
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

module.exports = SearchChinese