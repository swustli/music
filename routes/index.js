var express = require('express');
var router = express.Router();
var path = require("path");
var media = path.join(__dirname,"../public/media");
var fs = require("fs");
var multer = require('multer');
// 通过 filename 属性定制
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/media');    // 保存的路径，备注：需要自己创建
    },
    filename: function (req, file, cb) {
        // 保存文件名
        cb(null, file.originalname);  
    }
});
// 通过 storage 选项来对 上传行为 进行定制化
var upload = multer({ storage: storage })

/* GET home page. */
router.get('/', function(req, res, next) {
	fs.readdir(media,function(err,names){
		if (err) {
			console.log(err);
		}
		res.render('index', { title: '在线音乐可视化',music:names});
	});
  
});

router.get('/upload', function(req, res, next) {
	fs.readdir(media,function(err,names){
		if (err) {
			console.log(err);
		}
		res.render('upload', { title: '在线音乐可视化'});
	});
  
});

router.post('/upload', upload.single('file') ,function(req, res, next){
    var file = req.file;
    console.log("音频文件上传成功！");
    //res.redirect("/");
    fs.readdir(media,function(err,names){
		if (err) {
			console.log(err);
		}
		//res.render('index', { title: '在线音乐可视化',music:names});
	});
    
});

module.exports = router;
