// 引入 express 框架 -> 需 npm 安装
var express = require('express');
const path = require('path');
// 导入cors中间件
const cors = require("cors");
const userRouter = require("./router/index")


/**
 * 初始化框架,并将初始化后的函数给予 '当前页面'全局变量 app
 * 也就是说, app 是 express 
 */
var app = express();
// 将cors注册为全局中间件
app.use(cors()); //不传参默认允许简单跨域和预检跨域
// 配置解析 application/x-www-form-urlencoded 格式的表单数据的中间件
app.use(express.urlencoded({ extended: false }));
/* 配置框架环境 S */
// 设置静态文件夹
app.use(express.static(path.join(__dirname, 'public')));

// 设置 yh 为静态文件的存放文件夹
app.use('/yh', userRouter);



/* 配置框架环境 E */

var server = app.listen(5174, function() {

    var host = server.address().address
    var port = server.address().port
    
    console.log("Node.JS 服务器已启动，访问地址： http://%s:%s", host, port)

})