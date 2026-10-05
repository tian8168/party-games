/**
 * 大富翁 (Monopoly) · 经典中国标准版地图与卡牌数据
 * 包含全部40个标准棋盘地格（经典中文地名、车站、公共设施、税费、监狱与起点）
 * 以及完整的16张机会卡与16张命运宝箱卡深度汉化。
 */

function Square(name, pricetext, color, price, groupNumber, baserent, rent1, rent2, rent3, rent4, rent5) {
	this.name = name;
	this.pricetext = pricetext;
	this.color = color;
	this.owner = 0;
	this.mortgage = false;
	this.house = 0;
	this.hotel = 0;
	this.groupNumber = groupNumber || 0;
	this.price = (price || 0);
	this.baserent = (baserent || 0);
	this.rent1 = (rent1 || 0);
	this.rent2 = (rent2 || 0);
	this.rent3 = (rent3 || 0);
	this.rent4 = (rent4 || 0);
	this.rent5 = (rent5 || 0);
	this.landcount = 0;

	if (groupNumber === 3 || groupNumber === 4) {
		this.houseprice = 50;
	} else if (groupNumber === 5 || groupNumber === 6) {
		this.houseprice = 100;
	} else if (groupNumber === 7 || groupNumber === 8) {
		this.houseprice = 150;
	} else if (groupNumber === 9 || groupNumber === 10) {
		this.houseprice = 200;
	} else {
		this.houseprice = 0;
	}
}

function Card(text, action) {
	this.text = text;
	this.action = action;
}

function corrections() {
	// 保持地中海大道中文字符美观
	var cell1 = document.getElementById("cell1name");
	if (cell1) cell1.textContent = "地中海大道";

	// 为放大预览悬浮窗补充对应图标
	var e5 = document.getElementById("enlarge5token");
	if (e5) e5.innerHTML += '<img src="images/train_icon.png" height="60" width="65" alt="" style="position: relative; bottom: 20px;" />';
	var e15 = document.getElementById("enlarge15token");
	if (e15) e15.innerHTML += '<img src="images/train_icon.png" height="60" width="65" alt="" style="position: relative; top: -20px;" />';
	var e25 = document.getElementById("enlarge25token");
	if (e25) e25.innerHTML += '<img src="images/train_icon.png" height="60" width="65" alt="" style="position: relative; top: -20px;" />';
	var e35 = document.getElementById("enlarge35token");
	if (e35) e35.innerHTML += '<img src="images/train_icon.png" height="60" width="65" alt="" style="position: relative; top: -20px;" />';
	var e12 = document.getElementById("enlarge12token");
	if (e12) e12.innerHTML += '<img src="images/electric_icon.png" height="60" width="48" alt="" style="position: relative; top: -20px;" />';
	var e28 = document.getElementById("enlarge28token");
	if (e28) e28.innerHTML += '<img src="images/water_icon.png" height="60" width="78" alt="" style="position: relative; top: -20px;" />';
}

function utiltext() {
	return '<div style="font-size: 13px; line-height: 1.6; padding: 4px;">• 拥有 <b>1 处</b> 公共事业设施：<br />&nbsp;&nbsp;租金为本次掷出骰子点数的 <b>4 倍</b>。<br /><br />• 集齐 <b>2 处</b> 公共事业设施：<br />&nbsp;&nbsp;租金为本次掷出骰子点数的 <b>10 倍</b>。</div>';
}

function transtext() {
	return '<div style="font-size: 13px; line-height: 1.6; padding: 4px;"><b>火车站阶梯租金表：</b><br />• 拥有 1 座火车站：<span style="float: right; font-weight: bold;">$25</span><br />• 拥有 2 座火车站：<span style="float: right; font-weight: bold;">$50</span><br />• 拥有 3 座火车站：<span style="float: right; font-weight: bold;">$100</span><br />• 拥有 4 座火车站：<span style="float: right; font-weight: bold;">$200</span></div>';
}

function luxurytax() {
	addAlert("玩家 " + player[turn].name + " 到达【奢侈品税】，缴纳了 $100 税金。");
	player[turn].pay(100, 0);

	$("#landed").show().text("你到达了【奢侈品税】格，需缴纳 $100 奢侈品税。");
}

function citytax() {
	addAlert("玩家 " + player[turn].name + " 到达【城市所得税】，缴纳了 $200 税金。");
	player[turn].pay(200, 0);

	$("#landed").show().text("你到达了【城市所得税】格，需缴纳 $200 所得税。");
}

var square = [];

// 棋盘全部 40 个格子定义 (经典中文标准版)
square[0] = new Square("起点 (GO)", "每次路过或停留在起点，领取 $200 薪资", "#FFFFFF");
square[1] = new Square("地中海大道", "$60", "#8B4513", 60, 3, 2, 10, 30, 90, 160, 250);
square[2] = new Square("命运宝箱", "抽取一张命运卡并执行指示", "#FFFFFF");
square[3] = new Square("波罗的海大道", "$60", "#8B4513", 60, 3, 4, 20, 60, 180, 320, 450);
square[4] = new Square("城市所得税", "缴纳 $200 税金", "#FFFFFF");
square[5] = new Square("雷丁火车站", "$200", "#FFFFFF", 200, 1);
square[6] = new Square("东方大道", "$100", "#87CEEB", 100, 4, 6, 30, 90, 270, 400, 550);
square[7] = new Square("机会", "抽取一张机会卡并执行指示", "#FFFFFF");
square[8] = new Square("佛蒙特大道", "$100", "#87CEEB", 100, 4, 6, 30, 90, 270, 400, 550);
square[9] = new Square("康涅狄格大道", "$120", "#87CEEB", 120, 4, 8, 40, 100, 300, 450, 600);
square[10] = new Square("探监区 / 监狱", "探监路过，或在此服刑", "#FFFFFF");
square[11] = new Square("圣查尔斯街", "$140", "#FF0080", 140, 5, 10, 50, 150, 450, 625, 750);
square[12] = new Square("电力公司", "$150", "#FFFFFF", 150, 2);
square[13] = new Square("联邦大道", "$140", "#FF0080", 140, 5, 10, 50, 150, 450, 625, 750);
square[14] = new Square("弗吉尼亚大道", "$160", "#FF0080", 160, 5, 12, 60, 180, 500, 700, 900);
square[15] = new Square("宾夕法尼亚火车站", "$200", "#FFFFFF", 200, 1);
square[16] = new Square("圣詹姆斯广场", "$180", "#FFA500", 180, 6, 14, 70, 200, 550, 750, 950);
square[17] = new Square("命运宝箱", "抽取一张命运卡并执行指示", "#FFFFFF");
square[18] = new Square("田纳西大道", "$180", "#FFA500", 180, 6, 14, 70, 200, 550, 750, 950);
square[19] = new Square("纽约大道", "$200", "#FFA500", 200, 6, 16, 80, 220, 600, 800, 1000);
square[20] = new Square("免费停车场", "休憩片刻，免收任何费用", "#FFFFFF");
square[21] = new Square("肯塔基大道", "$220", "#FF0000", 220, 7, 18, 90, 250, 700, 875, 1050);
square[22] = new Square("机会", "抽取一张机会卡并执行指示", "#FFFFFF");
square[23] = new Square("印第安纳大道", "$220", "#FF0000", 220, 7, 18, 90, 250, 700, 875, 1050);
square[24] = new Square("伊利诺伊大道", "$240", "#FF0000", 240, 7, 20, 100, 300, 750, 925, 1100);
square[25] = new Square("巴尔的摩火车站", "$200", "#FFFFFF", 200, 1);
square[26] = new Square("大西洋大道", "$260", "#FFFF00", 260, 8, 22, 110, 330, 800, 975, 1150);
square[27] = new Square("文特诺大道", "$260", "#FFFF00", 260, 8, 22, 110, 330, 800, 975, 1150);
square[28] = new Square("自来水厂", "$150", "#FFFFFF", 150, 2);
square[29] = new Square("马文花园", "$280", "#FFFF00", 280, 8, 24, 120, 360, 850, 1025, 1200);
square[30] = new Square("前往监狱", "直接前往监狱，不得经过起点，不领 $200", "#FFFFFF");
square[31] = new Square("太平洋大道", "$300", "#008000", 300, 9, 26, 130, 390, 900, 1100, 1275);
square[32] = new Square("北卡罗来纳大道", "$300", "#008000", 300, 9, 26, 130, 390, 900, 1100, 1275);
square[33] = new Square("命运宝箱", "抽取一张命运卡并执行指示", "#FFFFFF");
square[34] = new Square("宾夕法尼亚大道", "$320", "#008000", 320, 9, 28, 150, 450, 1000, 1200, 1400);
square[35] = new Square("捷运短线火车站", "$200", "#FFFFFF", 200, 1);
square[36] = new Square("机会", "抽取一张机会卡并执行指示", "#FFFFFF");
square[37] = new Square("公园广场", "$350", "#0000FF", 350, 10, 35, 175, 500, 1100, 1300, 1500);
square[38] = new Square("奢侈品税", "缴纳 $100 奢侈品税", "#FFFFFF");
square[39] = new Square("木板道", "$400", "#0000FF", 400, 10, 50, 200, 600, 1400, 1700, 2000);

// 命运宝箱卡 (Community Chest) - 共 16 张
var communityChestCards = [];
var chanceCards = [];

communityChestCards[0] = new Card("【出狱许可】免费出狱卡。此卡可保留至需要时使用，亦可转让交易。", function(p) { p.communityChestJailCard = true; updateOwned();});
communityChestCards[1] = new Card("【选美获奖】你在选美大赛中荣获第二名，奖励 $10。", function() { addamount(10, '选美比赛');});
communityChestCards[2] = new Card("【股票获利】股票抛售套现，获得投资收益 $50。", function() { addamount(50, '股票收益');});
communityChestCards[3] = new Card("【保险期满】人寿保险期满返还，领取 $100。", function() { addamount(100, '人寿保险');});
communityChestCards[4] = new Card("【退税到账】个人所得税年度汇算清缴退税，收到退税款 $20。", function() { addamount(20, '所得税退税');});
communityChestCards[5] = new Card("【节日储蓄】假日储蓄基金期满到期，获得本息 $100。", function() { addamount(100, '假日基金');});
communityChestCards[6] = new Card("【遗产继承】你继承了一笔远亲遗产，获得 $100。", function() { addamount(100, '继承遗产');});
communityChestCards[7] = new Card("【顾问酬金】提供专业战略咨询，收取顾问费 $25。", function() { addamount(25, '咨询费');});
communityChestCards[8] = new Card("【医疗账单】支付私立医院体检治疗费 $100。", function() { subtractamount(100, '医疗费');});
communityChestCards[9] = new Card("【银行记账】银行结算系统出错对你有利，获赠 $200。", function() { addamount(200, '银行结余错误');});
communityChestCards[10] = new Card("【学杂费用】为子女缴纳新学期学杂费 $50。", function() { subtractamount(50, '学校学费');});
communityChestCards[11] = new Card("【诊所账单】支付家庭医生出诊挂号费 $50。", function() { subtractamount(50, '医生诊金');});
communityChestCards[12] = new Card("【生日礼金】今天是你的生日！向每位其他玩家收取 $10 礼金。", function() { collectfromeachplayer(10, '生日派对礼金');});
communityChestCards[13] = new Card("【直奔起点】直达【起点 (GO)】，领取 $200 薪资。", function() { advance(0);});
communityChestCards[14] = new Card("【街道维护】名下房产资产清查维护：每套普通房屋缴纳 $40，每栋豪华酒店缴纳 $115。", function() { streetrepairs(40, 115);});
communityChestCards[15] = new Card("【拘捕入狱】直接押送监狱！不得经过起点，不得领取 $200。", function() { gotojail();});

// 机会卡 (Chance) - 共 16 张
chanceCards[0] = new Card("【出狱许可】免费出狱卡。此卡可保留至需要时使用，亦可转让交易。", function(p) { p.chanceJailCard = true; updateOwned();});
chanceCards[1] = new Card("【房屋翻修】全面维护名下所有房产：每套普通房屋支付 $25，每栋豪华酒店支付 $100。", function() { streetrepairs(25, 100);});
chanceCards[2] = new Card("【超速罚单】在快速路违章超速驾驶，缴纳交警罚款 $15。", function() { subtractamount(15, '超速罚款');});
chanceCards[3] = new Card("【当选董事长】恭喜当选集团董事会主席，请向每位其他玩家发放 $50 分红礼金。", function() { payeachplayer(50, '当选董事会主席');});
chanceCards[4] = new Card("【后退三步】突遇突发路障，退后 3 格。", function() { gobackthreespaces();});
chanceCards[5] = new Card("【公共设施】直达最近的公共设施（电力公司或自来水厂）。若无人拥有可按标价购买；若已有人拥有，掷骰子并向其支付点数 10 倍的巨额租金！", function() { advanceToNearestUtility();});
chanceCards[6] = new Card("【股票分红】银行派发上市公司季度股息，领取 $50。", function() { addamount(50, '银行股息');});
chanceCards[7] = new Card("【铁路专线】直达最近的火车站。若无人拥有可按标价购买；若已有人拥有，向其支付双倍租金！", function() { advanceToNearestRailroad();});
chanceCards[8] = new Card("【公益捐款】缴纳市政贫困救济捐税 $15。", function() { subtractamount(15, '公益捐款');});
chanceCards[9] = new Card("【前往车站】直达【雷丁火车站】，若途径起点可领取 $200 薪资。", function() { advance(5);});
chanceCards[10] = new Card("【黄金地段】直达全城最顶奢地产【木板道 (Boardwalk)】！", function() { advance(39);});
chanceCards[11] = new Card("【前往伊利诺伊】直达【伊利诺伊大道】，若途径起点可领取 $200 薪资。", function() { advance(24);});
chanceCards[12] = new Card("【贷款收益】房屋建筑抵押贷款期满结算，提取收益 $150。", function() { addamount(150, '房贷返还');});
chanceCards[13] = new Card("【铁路专线】直达最近的火车站。若无人拥有可按标价购买；若已有人拥有，向其支付双倍租金！", function() { advanceToNearestRailroad();});
chanceCards[14] = new Card("【前往圣查尔斯】直达【圣查尔斯街】，若途径起点可领取 $200 薪资。", function() { advance(11);});
chanceCards[15] = new Card("【拘捕入狱】立刻逮捕入狱！直接押送监狱，不得经过起点，不得领取 $200。", function() { gotojail();});

// 导出全局对象，确保在浏览器全局环境及 Node 测试运行环境中均能无缝访问
if (typeof window !== 'undefined') {
	window.Square = Square;
	window.Card = Card;
	window.corrections = corrections;
	window.utiltext = utiltext;
	window.transtext = transtext;
	window.luxurytax = luxurytax;
	window.citytax = citytax;
	window.square = square;
	window.communityChestCards = communityChestCards;
	window.chanceCards = chanceCards;
}
if (typeof globalThis !== 'undefined') {
	globalThis.Square = Square;
	globalThis.Card = Card;
	globalThis.corrections = corrections;
	globalThis.utiltext = utiltext;
	globalThis.transtext = transtext;
	globalThis.luxurytax = luxurytax;
	globalThis.citytax = citytax;
	globalThis.square = square;
	globalThis.communityChestCards = communityChestCards;
	globalThis.chanceCards = chanceCards;
}
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		Square,
		Card,
		corrections,
		utiltext,
		transtext,
		luxurytax,
		citytax,
		square,
		communityChestCards,
		chanceCards
	};
}
