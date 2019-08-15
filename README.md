# multi-language
多语言包抽取，替换

```
  🤢🤢🤢
  替换有风险  使用须谨慎
```

- 主要支持vue和js的中文抽取和替换

## scripts

- searchJson 查找项目中的中文,导出json信息  ${projectName}_${searchFileName}.json
- exportJson  根据json信息导出,作为中文语言包   ${projectName}_${exportFileName}.json
- replace  根据json信息替换项目中的中文写法

## 注意事项

js文件使用vue-i18n 导出一个对象使用 @see https://github.com/kazupon/vue-i18n/issues/149#issuecomment-357455921

执行 replace 会自动添加 `import { i18n } from 'src/lang'`
   
```javascript
    import Vue from 'vue'
    import VueI18n from 'vue-i18n'
    import us from 'locales/cloudflow-mobile_en-US.json'
    import cn from 'locales/cloudflow-mobile_zh-CN.json'
    
    Vue.use(VueI18n)
    
    const messages = {
        cn: cn,
        us: us
    }
    
    // Create VueI18n instance with options
    export const i18n = new VueI18n({
        locale: 'us',
        messages: messages
    })
```
## 已知bugs

- 多个 ' " ` 混合使用替换的会有问题

- vue中不能使用this.$t替换的问题
 
- 加号连接的字符串处理僵硬.