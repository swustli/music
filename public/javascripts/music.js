function MusicVisualizer(options){
	//播放过的bufferSource的对象
	this.buffer = {};

	//当前正在播放的bufferSource
	this.source = null;

	//通过audio标签创建MediaaudioElementSourceNode时使用的audio元素
	this.audio = new Audio();
	
	this.audioSource = MusicVisualizer.ac.createMediaElementSource(this.audio);

	//选择过的资源数的累计值
	this.count = 0;

	//播完后的回调
	this.onended = options.onended;

	//unit8Array的长度
	this.size = options.size || 32;

	//可视化调用的绘图函数
	this.visualizer = options.visualizer;

	//初次加载第一首音乐成功时回调函数，针对苹果禁止自动播放用
	this.initCallback = null;

	//控制音量的GainNode
	this.gainNode = MusicVisualizer.ac[MusicVisualizer.ac.createGain ? "createGain" : "createGainNode"]();

	//音频分析对象
	this.analyser = MusicVisualizer.ac.createAnalyser();

	//延迟对象
	this.delayNode = MusicVisualizer.ac.createDelay(179);

	typeof options.delay === 'number' && (this.delayNode.delayTime.value = options.delay);
	//this.delayNode.delayTime.value = 5;

	this.analyser.connect(this.delayNode);

	this.delayNode.connect(this.gainNode);

	this.gainNode.connect(MusicVisualizer.ac.destination);

	//xhr对象
	this.xhr = new window.XMLHttpRequest();

	this.url = null;
	this.result = null;

	MusicVisualizer.visualize(this);
}

MusicVisualizer.ac = new (window.AudioContext ||window.webkitAudioContext || window.mozAudioContext)();

//检测是否为function
MusicVisualizer.isFunction = function(fun){
	return Object.prototype.toString.call(fun) == "[object Function]";
}

/*从指定的路径加载音频资源
 *@param xhr XMLHttpRequest
 *@param path string,音频资源路径
 *@param fun function,decode成功后的回调函数，将arraybuffer作为this
*/
MusicVisualizer.load = function(xhr, path, fun){
	xhr.abort();
	xhr.open("GET", path, true);
	xhr.responseType = "arraybuffer";

	xhr.onload = function(){
		MusicVisualizer.isFunction(fun) && fun.call(xhr.response);
	}
	xhr.send();
}

//播放mv对象的source,mv.onended为播放结束后的回调
MusicVisualizer.play = function(mv){
	mv.source.connect(mv.analyser);
	//设置网页显示音乐控制面板
	mv.audio.src = mv.url;
	mv.audio.controls = true;
	mv.audio.autoplay = true;
	if(document.getElementsByTagName('audio').length>0){
		document.getElementById('playerbox').removeChild(document.getElementsByTagName('audio')[0]);
		document.getElementById('playerbox').appendChild(mv.audio);
		document.getElementsByTagName('audio')[0].style.width = '100%';	
	}else{
		document.getElementById('playerbox').appendChild(mv.audio);
		document.getElementsByTagName('audio')[0].style.width = '100%';	
	} 
	if(mv.url instanceof ArrayBuffer){
		var p = document.getElementById('lyricContainer');
		p.innerHTML = "暂无歌词";
	}else{
		var xmlhttp=new XMLHttpRequest();
		xmlhttp.open("GET",mv.url.replace("mp3","lrc"),true);
		xmlhttp.send(null);
		xmlhttp.onload = function(e) {
	        if(xmlhttp.readyState==4){   
				if(xmlhttp.status==200){
					mv.getLyric(mv.url.replace("mp3","lrc"));
				}else{//其他状态 
					var p = document.getElementById('lyricContainer');
					p.innerHTML = "暂无歌词";
				};  
			} 
	    };
	}

	//开始播放
	if(mv.source === mv.audioSource){
		mv.audio.play();
		mv.audio.onended = mv.onended;
	}else{		
		//兼容较老的API
		mv.source[mv.source.start ? "start" : "noteOn"](0);

		//为该bufferSource绑定onended事件
		MusicVisualizer.isFunction(mv.onended) && (mv.source.onended = mv.onended);
	}
}

//停止mv.source
MusicVisualizer.stop = function(mv){
	if(mv.source === mv.audioSource){
		mv.audio.pause();
		mv.audio.onended = window.undefined;
	}else{
		//兼容较老的API
		mv.source[mv.source.stop ? "stop" : "noteOff"](0);

		//停止后移除之前为mv.source绑定的onended事件
		mv.source.onended = window.undefined;
	}	
}

/*可视化当前正在播放的音频
 *@param mv MusicVisualizer,MusicVisualizer的实例对象
*/
MusicVisualizer.visualize = function(mv){
	mv.analyser.fftSize = mv.size * 2;
	var arr = new Uint8Array(mv.analyser.frequencyBinCount);

	var requestAnimationFrame = window.requestAnimationFrame || 
								window.webkitRequestAnimationFrame || 
								window.oRequestAnimationFrame || 
								window.mzRequestAnimationFrame;
	var oldav = 0;
	function v(){
		mv.analyser.getByteFrequencyData(arr);
		var av = Math.round(100 * Array.prototype.reduce.call(arr, function(x, y){return x + y}) / mv.size / 256);
		var dlav = av - oldav;
		oldav = av;
		//将分析得到的音频数据传递给mv.visualizer方法可视化
		mv.visualizer.call(arr, dlav, av);
		requestAnimationFrame(v);
	}

	MusicVisualizer.isFunction(mv.visualizer) && requestAnimationFrame(v);
}

//将arraybuffer数据decode得到buffer
//成功后将bufferSourceNode作为fun回调的this
MusicVisualizer.prototype.decode = function(arraybuffer, fun){
	var self = this;
	MusicVisualizer.ac.decodeAudioData(arraybuffer, function(buffer){
		var bufferSourceNode = MusicVisualizer.ac.createBufferSource();
		bufferSourceNode.buffer = buffer;
		fun.call(bufferSourceNode);
	},function(err){
		console.log(err);
	})
}

MusicVisualizer.prototype.play = function(path, isMobile/*是否移动设备*/){
	var self = this;
	var count = ++self.count;
	this.url = path;

	//停止当前正在播放的bufferSource
	self.source && MusicVisualizer.stop(self);

	if(path instanceof ArrayBuffer){
		self.decode(path, function(){
			self.initCallback && !self.source && MusicVisualizer.isFunction(self.initCallback) && self.initCallback();
			self.source = this;
			MusicVisualizer.play(self);
		});
	}
	if(typeof(path) === 'string'){
		
		//pc上通过audio标签创建MediaaudioElementSourceNode，比ajax请求再解码要快
		if(!isMobile){
			//self.audio.src = path;
			self.audio = new Audio(path);
			self.audioSource = MusicVisualizer.ac.createMediaElementSource(self.audio);
			//console.log(path);

			self.initCallback && !self.source && MusicVisualizer.isFunction(self.initCallback) && self.initCallback();

			self.source = self.audioSource;
			
			MusicVisualizer.play(self);

			return;
		}
		
		//安卓iphone等移动设备上使用ajax请求arraybuffer再解码
		//安卓iphone等移动设备上audio播放流似乎没被re-routed到audioContext中
		if(path in self.buffer){
			MusicVisualizer.stop(self.source);

			var bufferSource = MusicVisualizer.ac.createBufferSource();
			bufferSource.buffer = self.buffer[path];	
			self.source = bufferSource;
			MusicVisualizer.play(self);
		}else{
			MusicVisualizer.load(self.xhr, path, function(){

				if(count != self.count)return;

				self.decode(this, function(){

					if(count != self.count)return;

					//将decode好的buffer缓存起来
					//self.buffer[path] = this.buffer;
					
					self.initCallback && !self.source && MusicVisualizer.isFunction(self.initCallback) && self.initCallback();
					
					self.source = this;

					MusicVisualizer.play(self);
				});
			})
		}
	}
}


//直接播放当前的bufferSource，在苹果设备用户触发时调用
MusicVisualizer.prototype.start = function(){
	if(this.source === this.audioSource){
		this.audio.play();
	}else{
		this.source && this.source[this.source.start ? "start" : "noteOn"](0);
	}	
}

//应用加载完毕，为苹果设备添加用户触发的事件
MusicVisualizer.prototype.addinit = function(fun){
	this.initCallback = fun;
}

//音量调节
MusicVisualizer.prototype.changeVolume = function(rate){
	this.gainNode.gain.value = rate * rate;
}

MusicVisualizer.prototype.getLyric = function(url) {
    //建立一个XMLHttpRequest请求
    var request = new XMLHttpRequest();
    //配置, url为歌词地址，比如：'./content/songs/foo.lrc'
    request.abort();
    request.open('GET', url, true);
    //因为我们需要的歌词是纯文本形式的，所以设置返回类型为文本
    request.responseType = 'text';
    //一旦请求成功，但得到了想要的歌词了
    request.onload = function() {
        //这里获得歌词文件
        var lyric = request.response;
        var rt = MusicVisualizer.prototype.parseLyric(lyric);
        //获取页面上的audio标签
		var audio = document.getElementsByTagName('audio')[0],
	    //显示歌词的元素
	    lyricContainer = document.getElementById('lyricContainer');
		//监听ontimeupdate事件
		audio.ontimeupdate = function(e) {
			//console.log(lyric);
		    //遍历所有歌词，看哪句歌词的时间与当然时间吻合
		    for (var i = 0, l = rt.length; i < l; i++) {
		    	
		        if (this.currentTime+0.8 /*当前播放的时间+快进的时间*/ > rt[i][0]) {
		            //显示到页面
		            lyricContainer.textContent = rt[i][1];
		        };
		    };
		};
    };
    //向服务器发送请求
    request.send();

}

MusicVisualizer.prototype.parseLyric = function(text) {
    //将文本分隔成一行一行，存入数组
    var lines = text.split('\n'),
        //用于匹配时间的正则表达式，匹配的结果类似[xx:xx.xx]
        pattern = /\[\d{2}:\d{2}.\d{2}\]/g,
        //保存最终结果的数组
        result = [];
    //去掉不含时间的行
    while (!pattern.test(lines[0])) {
        lines = lines.slice(1);
    };
    //上面用'\n'生成生成数组时，结果中最后一个为空元素，这里将去掉
    lines[lines.length - 1].length === 0 && lines.pop();
    lines.forEach(function(v /*数组元素值*/ , i /*元素索引*/ , a /*数组本身*/ ) {
        //提取出时间[xx:xx.xx]
        var time = v.match(pattern),
            //提取歌词
            value = v.replace(pattern, '');
        //因为一行里面可能有多个时间，所以time有可能是[xx:xx.xx][xx:xx.xx][xx:xx.xx]的形式，需要进一步分隔
        time.forEach(function(v1, i1, a1) {
            //去掉时间里的中括号得到xx:xx.xx
            var t = v1.slice(1, -1).split(':');
            //将结果压入最终数组
            result.push([parseInt(t[0], 10) * 60 + parseFloat(t[1]), value]);
        });
    });
    //最后将结果数组中的元素按时间大小排序，以便保存之后正常显示歌词
    result.sort(function(a, b) {
        return a[0] - b[0];
    });
    return result;
}