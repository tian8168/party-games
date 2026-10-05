/**
 * 🎲 大富翁 (Monopoly) · 核心游戏引擎与在线协同中枢
 * 包含完整游戏规则循环、资产管理、拍卖、交易、破产清算、全面中文深度汉化、
 * 现代赛博霓虹拟物界面交互、3D骰子拟真动画、音效联动及 MQTT 异步在线多人协同。
 */

var player = [];
var pcount = 4;
var turn = 0, doublecount = 0;
var game;

window.player = player;
window.turn = turn;
window.doublecount = doublecount;

function shouldRunAi(p) {
	if (!p || p.human || !p.AI) return false;
	if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
		return MONOPOLY_ONLINE.state.myRole === 'host';
	}
	return true;
}

function Game() {
	var die1;
	var die2;
	var areDiceRolled = false;

	var auctionQueue = [];
	var highestbidder;
	var highestbid;
	var currentbidder = 1;
	var auctionproperty;

	this.rollDice = function() {
		die1 = Math.floor(Math.random() * 6) + 1;
		die2 = Math.floor(Math.random() * 6) + 1;
		areDiceRolled = true;
	};

	this.setDice = function(d1, d2) {
		die1 = d1;
		die2 = d2;
		areDiceRolled = true;
	};

	this.resetDice = function() {
		areDiceRolled = false;
	};

	this.next = function() {
		// 联机模式下的行动席位校验
		if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
			var isMyTurn = (turn === MONOPOLY_ONLINE.state.mySlot);
			var curPlayer = player[turn];
			var isAi = curPlayer ? !curPlayer.human : false;
			if (!isMyTurn && !(isAi && MONOPOLY_ONLINE.state.myRole === 'host')) {
				return;
			}
		}

		var p = player[turn];

		if (!p.human && p.money < 0) {
			p.AI.payDebt();

			if (p.money < 0) {
				popup("<p>玩家 " + p.name + " 资不抵债已破产！所有名下资产将移交清算给 " + player[p.creditor].name + "。</p>", game.bankruptcy);
			} else {
				roll();
			}
		} else if (areDiceRolled && doublecount === 0) {
			if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
				MONOPOLY_ONLINE.broadcastEndTurn();
				if (MONOPOLY_ONLINE.state.myRole === 'host') {
					MONOPOLY_ONLINE.broadcastSyncState();
				}
			}
			play();
		} else {
			roll();
		}
	};

	this.getDie = function(die) {
		if (die === 1) {
			return die1;
		} else {
			return die2;
		}
	};

	// 拍卖功能 (Auction functions):
	var finalizeAuction = function() {
		var p = player[highestbidder];
		var sq = square[auctionproperty];

		if (highestbid > 0) {
			p.pay(highestbid, 0);
			sq.owner = highestbidder;
			addAlert("玩家 " + p.name + " 以 $" + highestbid + " 竞拍赢得了【" + sq.name + "】。");
			if (window.AUDIO) window.AUDIO.play('card_play');
		}

		for (var i = 1; i <= pcount; i++) {
			player[i].bidding = true;
		}

		$("#popupbackground").hide();
		$("#popupwrap").hide();

		if (!game.auction()) {
			play();
		}
	};

	this.addPropertyToAuctionQueue = function(propertyIndex) {
		auctionQueue.push(propertyIndex);
	};

	this.auction = function() {
		if (auctionQueue.length === 0) {
			return false;
		}

		var index = auctionQueue.shift();
		var s = square[index];

		if (s.price === 0 || s.owner !== 0) {
			return game.auction();
		}

		auctionproperty = index;
		highestbidder = 0;
		highestbid = 0;
		currentbidder = turn + 1;

		if (currentbidder > pcount) {
			currentbidder -= pcount;
		}

		popup("<div style='font-weight: bold; font-size: 16px; margin-bottom: 10px;'>土地资产公开拍卖: <span id='propertyname'></span></div>" +
			"<div>当前最高出价: $<span id='highestbid'>0</span> (<span id='highestbidder'>暂无</span>)</div>" +
			"<div style='margin: 8px 0;'>轮到 <span id='currentbidder' style='font-weight:bold;color:#38bdf8;'></span> 出价:</div>" +
			"<div><input id='bid' title='请输入加价竞拍金额' style='width: 100%; padding: 6px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(15,23,42,0.8); color: #fff;' /></div>" +
			"<div style='margin-top: 12px; display: flex; gap: 8px; justify-content: center;'>" +
			"<input type='button' class='btn-action' value='加价' onclick='game.auctionBid();' title='提交出价' />" +
			"<input type='button' class='btn-action' value='放弃' title='本轮放弃加价' onclick='game.auctionPass();' />" +
			"<input type='button' class='btn-action danger' value='退出拍卖' title='彻底退出竞拍' onclick='if (confirm(\"确定要彻底放弃对该地产的竞价吗？\")) game.auctionExit();' />" +
			"</div>", "blank");

		document.getElementById("propertyname").innerHTML = "<a href='javascript:void(0);' onmouseover='showdeed(" + auctionproperty + ");' onmouseout='hidedeed();' class='statscellcolor' style='color:#38bdf8;text-decoration:none;font-weight:bold;'>【" + s.name + "】</a>";
		document.getElementById("highestbid").innerHTML = "0";
		document.getElementById("highestbidder").innerHTML = "暂无";
		document.getElementById("currentbidder").innerHTML = player[currentbidder].name;
		document.getElementById("bid").onkeydown = function (e) {
			var key = 0;
			var isCtrl = false;
			var isShift = false;

			if (window.event) {
				key = window.event.keyCode;
				isCtrl = window.event.ctrlKey;
				isShift = window.event.shiftKey;
			} else if (e) {
				key = e.keyCode;
				isCtrl = e.ctrlKey;
				isShift = e.shiftKey;
			}

			if (isNaN(key)) return true;
			if (key === 13) {
				game.auctionBid();
				return false;
			}
			if (key === 8 || key === 9 || key === 46 || (key >= 35 && key <= 40) || isCtrl) {
				return true;
			}
			if (isShift) return false;
			return (key >= 48 && key <= 57) || (key >= 96 && key <= 105);
		};

		document.getElementById("bid").onfocus = function () {
			this.style.color = "white";
			if (isNaN(this.value)) {
				this.value = "";
			}
		};

		updateMoney();

		if (!player[currentbidder].human) {
			currentbidder = turn;
			this.auctionPass();
		}
		return true;
	};

	this.auctionPass = function() {
		if (highestbidder === 0) {
			highestbidder = currentbidder;
		}

		while (true) {
			currentbidder++;

			if (currentbidder > pcount) {
				currentbidder -= pcount;
			}

			if (currentbidder == highestbidder) {
				finalizeAuction();
				return;
			} else if (player[currentbidder].bidding) {
				var p = player[currentbidder];

				if (!p.human) {
					var bid = p.AI.bid(auctionproperty, highestbid);

					if (bid === -1 || highestbid >= p.money) {
						p.bidding = false;
						addAlert("玩家 " + p.name + " 退出了拍卖。");
						continue;
					} else if (bid === 0) {
						addAlert("玩家 " + p.name + " 放弃加价。");
						continue;
					} else if (bid > 0) {
						this.auctionBid(bid);
						addAlert("玩家 " + p.name + " 出价 $" + bid + "。");
						continue;
					}
					return;
				} else {
					break;
				}
			}
		}

		document.getElementById("currentbidder").innerHTML = player[currentbidder].name;
		document.getElementById("bid").value = "";
		document.getElementById("bid").style.color = "white";
	};

	this.auctionBid = function(bid) {
		bid = bid || parseInt(document.getElementById("bid").value, 10);

		if (bid === "" || bid === null) {
			document.getElementById("bid").value = "请输入出价金额。";
			document.getElementById("bid").style.color = "#f87171";
		} else if (isNaN(bid)) {
			document.getElementById("bid").value = "出价必须为有效数字。";
			document.getElementById("bid").style.color = "#f87171";
		} else {
			if (bid > player[currentbidder].money) {
				document.getElementById("bid").value = "资金不足！无法出价 $" + bid + "。";
				document.getElementById("bid").style.color = "#f87171";
			} else if (bid > highestbid) {
				highestbid = bid;
				document.getElementById("highestbid").innerHTML = parseInt(bid, 10);
				highestbidder = currentbidder;
				document.getElementById("highestbidder").innerHTML = player[highestbidder].name;
				document.getElementById("bid").focus();

				if (player[currentbidder].human) {
					this.auctionPass();
				}
			} else {
				document.getElementById("bid").value = "出价必须高于当前最高价 ($" + highestbid + ")。";
				document.getElementById("bid").style.color = "#f87171";
			}
		}
	};

	this.auctionExit = function() {
		player[currentbidder].bidding = false;
		this.auctionPass();
	};

	// 交易功能 (Trade functions):
	var currentInitiator;
	var currentRecipient;

	var tradeMoneyOnKeyDown = function (e) {
		var key = 0;
		var isCtrl = false;
		var isShift = false;
		if (window.event) {
			key = window.event.keyCode;
			isCtrl = window.event.ctrlKey;
			isShift = window.event.shiftKey;
		} else if (e) {
			key = e.keyCode;
			isCtrl = e.ctrlKey;
			isShift = e.shiftKey;
		}
		if (isNaN(key)) return true;
		if (key === 13) return false;
		if (key === 8 || key === 9 || key === 46 || (key >= 35 && key <= 40) || isCtrl) return true;
		if (isShift) return false;
		return (key >= 48 && key <= 57) || (key >= 96 && key <= 105);
	};

	var tradeMoneyOnFocus = function () {
		this.style.color = "#fff";
		if (isNaN(this.value) || this.value === "0") {
			this.value = "";
		}
	};

	var tradeMoneyOnChange = function(e) {
		$("#proposetradebutton").show();
		$("#canceltradebutton").show();
		$("#accepttradebutton").hide();
		$("#rejecttradebutton").hide();

		var amount = this.value;
		if (isNaN(amount)) {
			this.value = "必须为数字金额";
			this.style.color = "#f87171";
			return false;
		}
		amount = Math.round(amount) || 0;
		this.value = amount;
		if (amount < 0) {
			this.value = "必须大于等于 0";
			this.style.color = "#f87171";
			return false;
		}
		return true;
	};

	var resetTrade = function(initiator, recipient, allowRecipientToBeChanged) {
		var currentSquare, currentTableRow, currentTableCell, currentTableCellCheckbox, nameSelect, currentOption, allGroupUninproved;

		var tableRowOnClick = function(e) {
			var checkboxElement = this.firstChild.firstChild;
			if (checkboxElement !== e.srcElement) {
				checkboxElement.checked = !checkboxElement.checked;
			}
			$("#proposetradebutton").show();
			$("#canceltradebutton").show();
			$("#accepttradebutton").hide();
			$("#rejecttradebutton").hide();
		};

		var initiatorProperty = document.getElementById("trade-leftp-property");
		var recipientProperty = document.getElementById("trade-rightp-property");

		currentInitiator = initiator;
		currentRecipient = recipient;

		while (initiatorProperty.lastChild) initiatorProperty.removeChild(initiatorProperty.lastChild);
		while (recipientProperty.lastChild) recipientProperty.removeChild(recipientProperty.lastChild);

		var initiatorSideTable = document.createElement("table");
		var recipientSideTable = document.createElement("table");

		for (var i = 0; i < 40; i++) {
			currentSquare = square[i];
			if (currentSquare.house > 0 || currentSquare.groupNumber === 0) continue;

			allGroupUninproved = true;
			var max = currentSquare.group.length;
			for (var j = 0; j < max; j++) {
				if (square[currentSquare.group[j]].house > 0) {
					allGroupUninproved = false;
					break;
				}
			}
			if (!allGroupUninproved) continue;

			if (currentSquare.owner === initiator.index) {
				currentTableRow = initiatorSideTable.appendChild(document.createElement("tr"));
				currentTableRow.onclick = tableRowOnClick;
				currentTableCell = currentTableRow.appendChild(document.createElement("td"));
				currentTableCell.className = "propertycellcheckbox";
				currentTableCellCheckbox = currentTableCell.appendChild(document.createElement("input"));
				currentTableCellCheckbox.type = "checkbox";
				currentTableCellCheckbox.id = "tradeleftcheckbox" + i;

				currentTableCell = currentTableRow.appendChild(document.createElement("td"));
				currentTableCell.className = "propertycellcolor";
				currentTableCell.style.backgroundColor = currentSquare.color;
				currentTableCell.propertyIndex = i;
				currentTableCell.onmouseover = function() {showdeed(this.propertyIndex);};
				currentTableCell.onmouseout = hidedeed;

				currentTableCell = currentTableRow.appendChild(document.createElement("td"));
				currentTableCell.className = "propertycellname";
				if (currentSquare.mortgage) {
					currentTableCell.title = "已抵押";
					currentTableCell.style.color = "grey";
				}
				currentTableCell.textContent = currentSquare.name;

			} else if (currentSquare.owner === recipient.index) {
				currentTableRow = recipientSideTable.appendChild(document.createElement("tr"));
				currentTableRow.onclick = tableRowOnClick;
				currentTableCell = currentTableRow.appendChild(document.createElement("td"));
				currentTableCell.className = "propertycellcheckbox";
				currentTableCellCheckbox = currentTableCell.appendChild(document.createElement("input"));
				currentTableCellCheckbox.type = "checkbox";
				currentTableCellCheckbox.id = "traderightcheckbox" + i;

				currentTableCell = currentTableRow.appendChild(document.createElement("td"));
				currentTableCell.className = "propertycellcolor";
				currentTableCell.style.backgroundColor = currentSquare.color;
				currentTableCell.propertyIndex = i;
				currentTableCell.onmouseover = function() {showdeed(this.propertyIndex);};
				currentTableCell.onmouseout = hidedeed;

				currentTableCell = currentTableRow.appendChild(document.createElement("td"));
				currentTableCell.className = "propertycellname";
				if (currentSquare.mortgage) {
					currentTableCell.title = "已抵押";
					currentTableCell.style.color = "grey";
				}
				currentTableCell.textContent = currentSquare.name;
			}
		}

		if (initiatorSideTable.lastChild) {
			initiatorProperty.appendChild(initiatorSideTable);
		} else {
			initiatorProperty.textContent = initiator.name + " 暂无可用于交易的地产。";
		}

		if (recipientSideTable.lastChild) {
			recipientProperty.appendChild(recipientSideTable);
		} else {
			recipientProperty.textContent = recipient.name + " 暂无可用于交易的地产。";
		}

		document.getElementById("trade-leftp-name").textContent = initiator.name;
		var currentName = document.getElementById("trade-rightp-name");

		if (allowRecipientToBeChanged && pcount > 2) {
			while (currentName.lastChild) currentName.removeChild(currentName.lastChild);
			nameSelect = currentName.appendChild(document.createElement("select"));
			for (var i = 1; i <= pcount; i++) {
				if (i === initiator.index) continue;
				currentOption = nameSelect.appendChild(document.createElement("option"));
				currentOption.value = i + "";
				currentOption.style.color = player[i].color;
				currentOption.textContent = player[i].name;
				if (i === recipient.index) currentOption.selected = "selected";
			}
			nameSelect.onchange = function() {
				resetTrade(currentInitiator, player[parseInt(this.value, 10)], true);
			};
			nameSelect.title = "选择交易对象玩家";
		} else {
			currentName.textContent = recipient.name;
		}

		document.getElementById("trade-leftp-money").value = "0";
		document.getElementById("trade-rightp-money").value = "0";
	};

	var readTrade = function() {
		var initiator = currentInitiator;
		var recipient = currentRecipient;
		var property = new Array(40);
		var money;
		var communityChestJailCard = 0;
		var chanceJailCard = 0;

		for (var i = 0; i < 40; i++) {
			if (document.getElementById("tradeleftcheckbox" + i) && document.getElementById("tradeleftcheckbox" + i).checked) {
				property[i] = 1;
			} else if (document.getElementById("traderightcheckbox" + i) && document.getElementById("traderightcheckbox" + i).checked) {
				property[i] = -1;
			} else {
				property[i] = 0;
			}
		}

		money = parseInt(document.getElementById("trade-leftp-money").value, 10) || 0;
		money -= parseInt(document.getElementById("trade-rightp-money").value, 10) || 0;

		return new Trade(initiator, recipient, money, property, communityChestJailCard, chanceJailCard);
	};

	var writeTrade = function(tradeObj) {
		resetTrade(tradeObj.getInitiator(), tradeObj.getRecipient(), false);

		for (var i = 0; i < 40; i++) {
			if (document.getElementById("tradeleftcheckbox" + i)) {
				document.getElementById("tradeleftcheckbox" + i).checked = (tradeObj.getProperty(i) === 1);
			}
			if (document.getElementById("traderightcheckbox" + i)) {
				document.getElementById("traderightcheckbox" + i).checked = (tradeObj.getProperty(i) === -1);
			}
		}

		if (tradeObj.getMoney() > 0) {
			document.getElementById("trade-leftp-money").value = tradeObj.getMoney() + "";
		} else {
			document.getElementById("trade-rightp-money").value = (-tradeObj.getMoney()) + "";
		}
	};

	this.trade = function(tradeObj) {
		$("#board-container").hide();
		$("#trade").show();
		$("#proposetradebutton").show();
		$("#canceltradebutton").show();
		$("#accepttradebutton").hide();
		$("#rejecttradebutton").hide();

		var elLeftMoney = document.getElementById("trade-leftp-money");
		var elRightMoney = document.getElementById("trade-rightp-money");
		if (elLeftMoney) {
			elLeftMoney.onkeydown = tradeMoneyOnKeyDown;
			elLeftMoney.onfocus = tradeMoneyOnFocus;
			elLeftMoney.onchange = tradeMoneyOnChange;
		}
		if (elRightMoney) {
			elRightMoney.onkeydown = tradeMoneyOnKeyDown;
			elRightMoney.onfocus = tradeMoneyOnFocus;
			elRightMoney.onchange = tradeMoneyOnChange;
		}

		if (tradeObj instanceof Trade) {
			writeTrade(tradeObj);
			this.proposeTrade();
		} else {
			var initiator = player[turn];
			var recipient = turn === 1 ? player[2] : player[1];
			currentInitiator = initiator;
			currentRecipient = recipient;
			resetTrade(initiator, recipient, true);
		}
	};

	this.cancelTrade = function() {
		$("#board-container").show();
		$("#trade").hide();
		if (!player[turn].human) {
			player[turn].AI.alertList = "";
			game.next();
		}
	};

	this.acceptTrade = function(tradeObj) {
		var money, initiator, recipient;

		if (!tradeObj) {
			tradeObj = readTrade();
		}

		money = tradeObj.getMoney();
		initiator = tradeObj.getInitiator();
		recipient = tradeObj.getRecipient();

		if (money > 0 && money > initiator.money) {
			popup("<p>资金不足！玩家 " + initiator.name + " 无法支付交易差额 $" + money + "。</p>");
			return false;
		} else if (money < 0 && -money > recipient.money) {
			popup("<p>资金不足！玩家 " + recipient.name + " 无法支付交易差额 $" + (-money) + "。</p>");
			return false;
		}

		// 交换地产
		for (var i = 0; i < 40; i++) {
			if (tradeObj.getProperty(i) === 1) {
				square[i].owner = recipient.index;
				addAlert("玩家 " + recipient.name + " 从 玩家 " + initiator.name + " 获得了【" + square[i].name + "】。");
			} else if (tradeObj.getProperty(i) === -1) {
				square[i].owner = initiator.index;
				addAlert("玩家 " + initiator.name + " 从 玩家 " + recipient.name + " 获得了【" + square[i].name + "】。");
			}
		}

		// 交换现金
		if (money > 0) {
			initiator.pay(money, recipient.index);
			recipient.money += money;
			addAlert("玩家 " + recipient.name + " 从 玩家 " + initiator.name + " 获得了 $" + money + " 交易补偿金。");
		} else if (money < 0) {
			money = -money;
			recipient.pay(money, initiator.index);
			initiator.money += money;
			addAlert("玩家 " + initiator.name + " 从 玩家 " + recipient.name + " 获得了 $" + money + " 交易补偿金。");
		}

		updateOwned();
		updateMoney();

		$("#board-container").show();
		$("#trade").hide();

		if (window.AUDIO) window.AUDIO.play('win');

		if (!player[turn].human) {
			player[turn].AI.alertList = "";
			game.next();
		}
	};

	this.proposeTrade = function() {
		var tradeObj = readTrade();
		var money = tradeObj.getMoney();
		var initiator = tradeObj.getInitiator();
		var recipient = tradeObj.getRecipient();
		var reversedTradeProperty = [];

		if (money > 0 && money > initiator.money) {
			popup("<p>资金不足！玩家 " + initiator.name + " 无法给付交易金额 $" + money + "。</p>");
			return false;
		} else if (money < 0 && -money > recipient.money) {
			popup("<p>资金不足！玩家 " + recipient.name + " 无法给付交易金额 $" + (-money) + "。</p>");
			return false;
		}

		var isAPropertySelected = 0;
		for (var i = 0; i < 40; i++) {
			reversedTradeProperty[i] = -tradeObj.getProperty(i);
			isAPropertySelected |= tradeObj.getProperty(i);
		}

		if (isAPropertySelected === 0) {
			popup("<p>发起交易必须至少选择一处地产资产进行置换！</p>");
			return false;
		}

		if (initiator.human && !confirm("玩家 " + initiator.name + "，确定要向 玩家 " + recipient.name + " 提交此笔交易协议吗？")) {
			return false;
		}

		var reversedTrade = new Trade(recipient, initiator, -money, reversedTradeProperty, 0, 0);

		if (recipient.human) {
			if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
				var tradePayload = {
					initiator: initiator.index,
					recipient: recipient.index,
					money: money,
					property: reversedTradeProperty,
					communityChestJailCard: 0,
					chanceJailCard: 0
				};
				MONOPOLY_ONLINE.broadcastTradePropose(tradePayload);
				popup("<p>交易提案已通过网络发送给 玩家【" + recipient.name + "】！<br/>请等待对方审核回应...</p>");
				$("#proposetradebutton, #canceltradebutton").hide();
				return;
			}

			writeTrade(reversedTrade);
			$("#proposetradebutton").hide();
			$("#canceltradebutton").hide();
			$("#accepttradebutton").show();
			$("#rejecttradebutton").show();

			addAlert("玩家 " + initiator.name + " 向 玩家 " + recipient.name + " 发起了交易提案。");
			popup("<p>玩家 " + initiator.name + " 向你（" + recipient.name + "）发起了资产交易提案。你可以选择接受、拒绝或修改条件。</p>");
		} else {
			var tradeResponse = recipient.AI.acceptTrade(tradeObj);

			if (tradeResponse === true) {
				popup("<p>电脑 " + recipient.name + " 经过评估，已同意并达成了交易协议！</p>");
				this.acceptTrade(reversedTrade);
			} else if (tradeResponse === false) {
				popup("<p>电脑 " + recipient.name + " 拒绝了本次交易提议。</p>");
				return;
			} else if (tradeResponse instanceof Trade) {
				popup("<p>电脑 " + recipient.name + " 提出了修改交易的还价方案。</p>");
				writeTrade(tradeResponse);
				$("#proposetradebutton, #canceltradebutton").hide();
				$("#accepttradebutton").show();
				$("#rejecttradebutton").show();
			}
		}
	};

	// 破产与出局逻辑 (Bankruptcy functions):
	this.eliminatePlayer = function() {
		var p = player[turn];
		var eliminatedIndex = p.index;

		for (var i = p.index; i < pcount; i++) {
			player[i] = player[i + 1];
			player[i].index = i;
		}

		for (var i = 0; i < 40; i++) {
			if (square[i].owner >= p.index) {
				square[i].owner--;
			}
		}

		pcount--;
		turn--;
		window.turn = turn;
		window.pcount = pcount;
		if (typeof globalThis !== 'undefined') {
			globalThis.pcount = pcount;
			globalThis.turn = turn;
		}

		if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
			MONOPOLY_ONLINE.handlePlayerEliminated(eliminatedIndex);
		}

		if (pcount === 1) {
			updateMoney();
			$("#control").hide();
			popup("<p>🏆 恭喜玩家 <b>" + player[1].name + "</b> 傲视群雄，赢得了本局大富翁的最终商业帝国大奖！</p>");
			if (window.AUDIO) window.AUDIO.play('win');
		} else {
			play();
		}
	};

	this.bankruptcyUnmortgage = function() {
		var p = player[turn];
		if (p.creditor === 0) {
			game.eliminatePlayer();
			return;
		}

		var HTML = "<p>玩家 " + player[p.creditor].name + "，你可以免收手续费直接赎回以下接收的抵押地产。点击确认继续。</p><table>";
		var price;

		for (var i = 0; i < 40; i++) {
			var sq = square[i];
			if (sq.owner == p.index && sq.mortgage) {
				price = Math.round(sq.price * 0.5);
				HTML += "<tr><td class='propertycellcolor' style='background: " + sq.color + ";' onmouseover='showdeed(" + i + ");' onmouseout='hidedeed();'></td>" +
					"<td class='propertycellname'><a href='javascript:void(0);' onclick='if (" + price + " <= player[" + p.creditor + "].money) {player[" + p.creditor + "].pay(" + price + ", 0); square[" + i + "].mortgage = false; addAlert(\"" + player[p.creditor].name + " 赎回了解除抵押的 " + sq.name + "。\");} this.parentElement.parentElement.style.display = \"none\";'>赎回 " + sq.name + " ($" + price + ")</a></td></tr>";
				sq.owner = p.creditor;
			}
		}
		HTML += "</table>";
		popup(HTML, game.eliminatePlayer);
	};

	this.resign = function(immediate) {
		var doResign = function() {
			var p = player[turn];
			if (p && p.money >= 0) {
				p.money = -1;
				p.creditor = 0;
			}
			game.bankruptcy();
		};

		if (immediate) {
			doResign();
		} else {
			popup("<p>确定要宣告破产认输退出本局游戏吗？名下所有房产与资产将移交清算！</p>", doResign, "Yes/No");
		}
	};

	this.bankruptcy = function(fromNetwork) {
		var p = player[turn];
		if (!p) return;
		if (fromNetwork && p.money >= 0) {
			p.money = -1;
			p.creditor = 0;
		}
		var pcredit = player[p.creditor];
		var bankruptcyUnmortgageFee = 0;

		if (p.money >= 0) return;

		addAlert("玩家 " + p.name + " 宣告破产出局！");
		if (window.AUDIO) window.AUDIO.play('bonk');

		if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline && !fromNetwork) {
			MONOPOLY_ONLINE.broadcastResign();
		}

		if (p.creditor !== 0 && pcredit) {
			pcredit.money += p.money;
		}

		for (var i = 0; i < 40; i++) {
			var sq = square[i];
			if (sq.owner == p.index) {
				if (!sq.mortgage) {
					sq.owner = p.creditor;
				} else {
					bankruptcyUnmortgageFee += Math.round(sq.price * 0.1);
				}

				if (sq.house > 0) {
					if (p.creditor !== 0 && pcredit) {
						pcredit.money += sq.houseprice * 0.5 * sq.house;
					}
					sq.hotel = 0;
					sq.house = 0;
				}

				if (p.creditor === 0) {
					sq.mortgage = false;
					game.addPropertyToAuctionQueue(i);
					sq.owner = 0;
				}
			}
		}

		updateMoney();

		if (p.chanceJailCard && pcredit) {
			p.chanceJailCard = false;
			pcredit.chanceJailCard = true;
		}
		if (p.communityChestJailCard && pcredit) {
			p.communityChestJailCard = false;
			pcredit.communityChestJailCard = true;
		}

		if (pcount === 2 || bankruptcyUnmortgageFee === 0 || p.creditor === 0) {
			game.eliminatePlayer();
		} else {
			addAlert("玩家 " + pcredit.name + " 为接收的破产抵押地产支付了 $" + bankruptcyUnmortgageFee + " 利息手续费。");
			popup("<p>玩家 " + pcredit.name + "，你需为接收自 " + p.name + " 的抵押地产支付 $" + bankruptcyUnmortgageFee + " 利息手续费。</p>", function() {
				player[pcredit.index].pay(bankruptcyUnmortgageFee, 0);
				game.bankruptcyUnmortgage();
			});
		}
	};
}

function Player(name, color) {
	this.name = name;
	this.color = color;
	this.position = 0;
	this.money = 1500;
	this.creditor = -1;
	this.jail = false;
	this.jailroll = 0;
	this.communityChestJailCard = false;
	this.chanceJailCard = false;
	this.bidding = true;
	this.human = true;

	this.pay = function (amount, creditor) {
		if (amount <= this.money) {
			this.money -= amount;
			updateMoney();
			return true;
		} else {
			this.money -= amount;
			this.creditor = creditor;
			updateMoney();
			return false;
		}
	};
}

function Trade(initiator, recipient, money, property, communityChestJailCard, chanceJailCard) {
	this.getInitiator = function() { return initiator; };
	this.getRecipient = function() { return recipient; };
	this.getProperty = function(index) {
		if (typeof index === "number") return property[index];
		return property;
	};
	this.getMoney = function() { return money; };
	this.getCommunityChestJailCard = function() { return communityChestJailCard; };
	this.getChanceJailCard = function() { return chanceJailCard; };
}

function addAlert(alertText) {
	var $alert = $("#alert");
	if (!$alert.length) return;

	var item = document.createElement("div");
	item.className = "alert-item";
	item.textContent = alertText;
	$alert.append(item);

	// 平滑滚动到底部
	$alert.stop().animate({"scrollTop": $alert.prop("scrollHeight")}, 300);

	if (player[turn] && !player[turn].human && player[turn].AI) {
		player[turn].AI.alertList += "<div>" + alertText + "</div>";
	}
}

function popup(HTML, action, option) {
	document.getElementById("popuptext").innerHTML = HTML;

	if (!option && typeof action === "string") {
		option = action;
	}
	option = option ? option.toLowerCase() : "";
	if (typeof action !== "function") {
		action = null;
	}

	if (option === "yes/no") {
		document.getElementById("popuptext").innerHTML += "<div style='margin-top: 14px; display: flex; gap: 10px; justify-content: center;'>" +
			"<input type='button' class='btn-action' value='确认 (是)' id='popupyes' />" +
			"<input type='button' class='btn-action danger' value='取消 (否)' id='popupno' />" +
			"</div>";

		$("#popupyes, #popupno").on("click", function() {
			$("#popupwrap").hide();
			$("#popupbackground").fadeOut(250);
		});
		$("#popupyes").on("click", action);

	} else if (option !== "blank") {
		$("#popuptext").append("<div style='margin-top: 14px; text-align: center;'><input type='button' class='btn-action' value='我知道了' id='popupclose' /></div>");
		$("#popupclose").focus();

		$("#popupclose").on("click", function() {
			$("#popupwrap").hide();
			$("#popupbackground").fadeOut(250);
		}).on("click", action);
	}

	$("#popupbackground").fadeIn(250, function() {
		$("#popupwrap").show();
	});
}

function updatePosition() {
	var jailEl = document.getElementById("jail");
	if (jailEl) jailEl.style.border = "1.5px solid rgba(255,255,255,0.3)";
	var jailHolder = document.getElementById("jailpositionholder");
	if (jailHolder) jailHolder.innerHTML = "";

	for (var i = 0; i < 40; i++) {
		var cell = document.getElementById("cell" + i);
		if (cell) cell.style.border = "1px solid var(--cell-border)";
		var holder = document.getElementById("cell" + i + "positionholder");
		if (holder) holder.innerHTML = "";
	}

	// 渲染棋盘上各个格子中的玩家霓虹棋子
	for (var x = 0; x < 40; x++) {
		var left = 4;
		var top = 4;

		for (var y = 1; y <= pcount; y++) {
			var py = player[y];
			if (py && py.position === x && !py.jail) {
				var holder = document.getElementById("cell" + x + "positionholder");
				if (holder) {
					var isCur = (turn === y);
					holder.innerHTML += "<div class='cell-position' title='" + py.name + "' style='background-color: " + py.color + "; box-shadow: 0 0 " + (isCur ? "10px #fff" : "5px " + py.color) + "; left: " + left + "px; top: " + top + "px;'>" + y + "</div>";
					left += 16;
					if (left >= 48) {
						left = 4;
						top += 16;
					}
				}
			}
		}
	}

	// 渲染监狱中的棋子
	if (jailHolder) {
		var jLeft = 4, jTop = 4;
		for (var i = 1; i <= pcount; i++) {
			var pi = player[i];
			if (pi && pi.jail) {
				jailHolder.innerHTML += "<div class='cell-position' title='" + pi.name + "' style='background-color: " + pi.color + "; left: " + jLeft + "px; top: " + jTop + "px;'>" + i + "</div>";
				jLeft += 16;
				if (jLeft >= 36) {
					jLeft = 4;
					jTop += 16;
				}
			}
		}
	}

	var p = player[turn];
	if (p) {
		if (p.jail && jailEl) {
			jailEl.style.border = "2px solid " + p.color;
			jailEl.style.boxShadow = "0 0 10px " + p.color;
		} else {
			var curCell = document.getElementById("cell" + p.position);
			if (curCell) {
				curCell.style.border = "2px solid " + p.color;
				curCell.style.boxShadow = "0 0 12px " + p.color;
			}
		}
	}
}

function updateMoney() {
	var p = player[turn];
	if (!p) return;

	var elPmoney = document.getElementById("pmoney");
	if (elPmoney) elPmoney.innerHTML = "$" + p.money;

	$(".money-bar-row").hide();
	for (var i = 1; i <= pcount; i++) {
		var p_i = player[i];
		$("#moneybarrow" + i).show();
		var pbar = document.getElementById("p" + i + "moneybar");
		if (pbar) pbar.style.border = "2px solid " + p_i.color;
		var pmoneyEl = document.getElementById("p" + i + "money");
		if (pmoneyEl) pmoneyEl.innerHTML = p_i.money;
		var pnameEl = document.getElementById("p" + i + "moneyname");
		if (pnameEl) pnameEl.innerHTML = p_i.name;
	}

	if (document.getElementById("landed") && document.getElementById("landed").innerHTML === "") {
		$("#landed").hide();
	}

	var quickstats = document.getElementById("quickstats");
	if (quickstats) quickstats.style.borderColor = p.color;

	if (p.money < 0) {
		$("#resignbutton").show();
		$("#nextbutton").hide();
	} else {
		$("#resignbutton").hide();
		$("#nextbutton").show();
	}

	updatePlayerHud();
}

function updatePlayerHud() {
	var hudContainer = document.getElementById("player-hud-list");
	if (!hudContainer) return;

	var html = "";
	for (var i = 1; i <= pcount; i++) {
		var p_i = player[i];
		if (!p_i) continue;
		var isCur = (turn === i);
		var propCount = 0;
		for (var s = 0; s < 40; s++) {
			if (square[s] && square[s].owner === i) propCount++;
		}
		var statusBadge = "";
		if (p_i.money < 0) statusBadge = "<span class='hud-badge bankrupt'>💀 已破产</span>";
		else if (p_i.jail) statusBadge = "<span class='hud-badge jail'>🔒 监狱</span>";
		else if (p_i.human) statusBadge = "<span class='hud-badge'>👤 玩家</span>";
		else statusBadge = "<span class='hud-badge ai'>🤖 电脑</span>";

		var isHost = (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline && MONOPOLY_ONLINE.state.players[i-1] && MONOPOLY_ONLINE.state.players[i-1].role === 'host');
		if (isHost) statusBadge = "<span class='hud-badge' style='background:rgba(245,158,11,0.2);color:#f59e0b;'>👑 房主</span>";

		html += "<div class='player-hud-card " + (isCur ? "active-turn" : "") + "' style='border-top: 3px solid " + p_i.color + ";'>" +
			"<div class='hud-avatar' style='background: " + p_i.color + "; box-shadow: 0 0 10px " + p_i.color + ";'>" + i + "</div>" +
			"<div class='hud-meta'>" +
				"<div class='hud-name'>" + p_i.name + " " + statusBadge + "</div>" +
				"<div class='hud-money'>$" + p_i.money + "</div>" +
				"<div class='hud-sub'>地产: " + propCount + " 处" + (p_i.communityChestJailCard || p_i.chanceJailCard ? " · 🎫出狱卡" : "") + "</div>" +
			"</div>" +
		"</div>";
	}
	hudContainer.innerHTML = html;

	// 同步行动控制台横幅
	var bannerAvatar = document.getElementById("turn-avatar");
	var bannerName = document.getElementById("pname");
	var bannerCash = document.getElementById("pmoney");
	var curP = player[turn];
	if (curP) {
		if (bannerAvatar) {
			bannerAvatar.textContent = turn;
			bannerAvatar.style.backgroundColor = curP.color;
			bannerAvatar.style.boxShadow = "0 0 10px " + curP.color;
		}
		if (bannerName) bannerName.textContent = curP.name + " 的回合";
		if (bannerCash) bannerCash.textContent = "$" + curP.money;
	}
}

function renderDieFace(el, val) {
	if (!el) return;
	el.innerHTML = "";
	var grid = document.createElement("div");
	grid.className = "die-pips-grid";

	var pipMap = {
		1: [4],
		2: [0, 8],
		3: [0, 4, 8],
		4: [0, 2, 6, 8],
		5: [0, 2, 4, 6, 8],
		6: [0, 2, 3, 5, 6, 8]
	};
	var pips = pipMap[val] || [4];

	for (var i = 0; i < 9; i++) {
		var cell = document.createElement("div");
		if (pips.indexOf(i) !== -1) {
			var pip = document.createElement("div");
			pip.className = "pip" + (val === 1 ? " red" : "");
			cell.appendChild(pip);
		}
		grid.appendChild(cell);
	}
	el.appendChild(grid);
}

function updateDice(d0, d1) {
	var die0 = d0 || game.getDie(1);
	var die1 = d1 || game.getDie(2);

	$("#die0").show();
	$("#die1").show();

	var el0 = document.getElementById("die0");
	var el1 = document.getElementById("die1");

	el0.classList.remove("die-no-img");
	el1.classList.remove("die-no-img");

	renderDieFace(el0, die0);
	renderDieFace(el1, die1);
}

function updateOwned() {
	var p = player[turn];
	var checkedproperty = getCheckedProperty();
	$("#option").show();
	$("#owned").show();

	var HTML = "", firstproperty = -1;
	var mortgagetext = "", housetext = "";
	var sq;

	for (var i = 0; i < 40; i++) {
		sq = square[i];
		var currentCellOwner = document.getElementById("cell" + i + "owner");
		if (sq.groupNumber && currentCellOwner) {
			if (sq.owner === 0) {
				currentCellOwner.style.display = "none";
			} else {
				currentCellOwner.style.display = "block";
				currentCellOwner.style.backgroundColor = player[sq.owner].color;
				currentCellOwner.style.boxShadow = "0 0 6px " + player[sq.owner].color;
				currentCellOwner.title = "拥有者: " + player[sq.owner].name;

				// 棋盘格上直接直观展示房屋与酒店图标徽章
				var bldEl = document.getElementById("cell" + i + "buildings");
				if (!bldEl) {
					bldEl = document.createElement("div");
					bldEl.id = "cell" + i + "buildings";
					bldEl.className = "cell-building-badge";
					var anchor = document.getElementById("cell" + i + "anchor");
					if (anchor) anchor.appendChild(bldEl);
				}
				if (bldEl) {
					if (sq.hotel) {
						bldEl.innerHTML = "🏨";
						bldEl.style.display = "block";
					} else if (sq.house > 0) {
						bldEl.innerHTML = "🏠x" + sq.house;
						bldEl.style.display = "block";
					} else if (sq.mortgage) {
						bldEl.innerHTML = "🔒";
						bldEl.style.display = "block";
					} else {
						bldEl.style.display = "none";
					}
				}
			}
		}
	}

	for (var i = 0; i < 40; i++) {
		sq = square[i];
		if (sq.owner == turn) {
			mortgagetext = "";
			if (sq.mortgage) {
				mortgagetext = "title='已抵押' style='color: grey;'";
			}

			housetext = "";
			if (sq.house >= 1 && sq.house <= 4) {
				housetext = " <span style='color:#10b981;font-weight:bold;'>🏠x" + sq.house + "</span>";
			} else if (sq.hotel) {
				housetext = " <span style='color:#f59e0b;font-weight:bold;'>🏨 豪华酒店</span>";
			}

			if (HTML === "") {
				HTML += "<table style='width:100%;border-collapse:collapse;'>";
				firstproperty = i;
			}

			HTML += "<tr class='property-cell-row' style='cursor:pointer;'><td class='propertycellcheckbox'><input type='checkbox' id='propertycheckbox" + i + "' /></td>" +
				"<td class='propertycellcolor' style='background: " + sq.color + "; width: 14px; border-radius: 3px;' onmouseover='showdeed(" + i + ");' onmouseout='hidedeed();'></td>" +
				"<td class='propertycellname' " + mortgagetext + " style='padding: 4px 8px; font-size: 12px; color: #fff;'>" + sq.name + housetext + "</td></tr>";
		}
	}

	if (p.communityChestJailCard) {
		if (HTML === "") { firstproperty = 40; HTML += "<table style='width:100%;border-collapse:collapse;'>"; }
		HTML += "<tr class='property-cell-row'><td class='propertycellcheckbox'><input type='checkbox' id='propertycheckbox40' /></td><td class='propertycellcolor' style='background: white;'></td><td class='propertycellname'>🎫 免费出狱卡 (命运宝箱)</td></tr>";
	}
	if (p.chanceJailCard) {
		if (HTML === "") { firstproperty = 41; HTML += "<table style='width:100%;border-collapse:collapse;'>"; }
		HTML += "<tr class='property-cell-row'><td class='propertycellcheckbox'><input type='checkbox' id='propertycheckbox41' /></td><td class='propertycellcolor' style='background: white;'></td><td class='propertycellname'>🎫 免费出狱卡 (机会)</td></tr>";
	}

	if (HTML === "") {
		HTML = "<div style='color:#94a3b8;font-size:12px;padding:8px;'>" + p.name + "，你名下暂未拥有任何房产地产。</div>";
		$("#option").hide();
	} else {
		HTML += "</table>";
	}

	document.getElementById("owned").innerHTML = HTML;

	if (checkedproperty > -1 && document.getElementById("propertycheckbox" + checkedproperty)) {
		document.getElementById("propertycheckbox" + checkedproperty).checked = true;
	} else if (firstproperty > -1 && document.getElementById("propertycheckbox" + firstproperty)) {
		document.getElementById("propertycheckbox" + firstproperty).checked = true;
	}

	$(".property-cell-row").click(function() {
		var row = this;
		$(this).find(".propertycellcheckbox > input").prop("checked", function(index, val) {
			return !val;
		});
		$(".propertycellcheckbox > input").prop("checked", function(index, val) {
			if (!$.contains(row, this)) return false;
			return val;
		});
		updateOption();
	});

	updateOption();
}

function updateOption() {
	var checkedproperty = getCheckedProperty();
	if (checkedproperty < 0 || checkedproperty >= 40) {
		$("#buyhousebutton, #sellhousebutton, #mortgagebutton").hide();
		return;
	}

	var sq = square[checkedproperty];
	var p = player[sq.owner];

	if (sq.groupNumber >= 3) {
		var allGroupOwned = true;
		var max = sq.group.length;
		for (var i = 0; i < max; i++) {
			if (square[sq.group[i]].owner !== sq.owner) {
				allGroupOwned = false;
				break;
			}
		}

		if (allGroupOwned && !sq.mortgage) {
			$("#buyhousebutton").show();
			if (sq.house < 4) {
				document.getElementById("buyhousebutton").value = "🏠 盖房屋 ($" + sq.houseprice + ")";
			} else {
				document.getElementById("buyhousebutton").value = "🏨 升级酒店 ($" + sq.houseprice + ")";
			}
		} else {
			$("#buyhousebutton").hide();
		}

		if (sq.house > 0) {
			$("#sellhousebutton").show();
			document.getElementById("sellhousebutton").value = "拆售房屋 (返还 $" + (sq.houseprice * 0.5) + ")";
		} else {
			$("#sellhousebutton").hide();
		}
	} else {
		$("#buyhousebutton").hide();
		$("#sellhousebutton").hide();
	}

	$("#mortgagebutton").show();
	if (sq.mortgage) {
		document.getElementById("mortgagebutton").value = "💰 赎回地产 ($" + Math.round(sq.price * 0.55) + ")";
	} else {
		document.getElementById("mortgagebutton").value = "💰 抵押地产 (获 $" + Math.round(sq.price * 0.5) + ")";
	}

	var housesum = 0, hotelsum = 0;
	for (var i = 0; i < 40; i++) {
		if (square[i].hotel === 1) hotelsum++;
		else housesum += square[i].house;
	}
	var bldEl = document.getElementById("buildings");
	if (bldEl) {
		bldEl.innerHTML = "<div style='font-size:11px;color:#94a3b8;margin-bottom:6px;'>市场余量：房屋 " + (32 - housesum) + "/32 · 酒店 " + (12 - hotelsum) + "/12</div>";
	}
}

function chanceCommunityChest() {
	var p = player[turn];
	var isLocalTurn = true;
	if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
		isLocalTurn = (turn === MONOPOLY_ONLINE.state.mySlot) || (MONOPOLY_ONLINE.state.myRole === 'host' && !p.human);
	}

	if (p.position === 2 || p.position === 17 || p.position === 33) {
		if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline && !isLocalTurn) {
			return;
		}

		var communityChestIndex = communityChestCards.deck[communityChestCards.index];
		if (communityChestIndex === 0) communityChestCards.deck.splice(communityChestCards.index, 1);
		communityChestCards.index++;
		if (communityChestCards.index >= communityChestCards.deck.length) communityChestCards.index = 0;

		if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
			MONOPOLY_ONLINE.broadcastCardDraw('communityChest', communityChestIndex);
		}

		if (p.human) {
			popup("<div style='display:flex;align-items:center;gap:10px;margin-bottom:8px;'>" +
				"<img src='images/community_chest_icon.png' style='height: 42px; width: 44px;' />" +
				"<div style='font-weight: 900; font-size: 16px; color: #38bdf8;'>命运宝箱 (Community Chest)</div>" +
				"</div><div style='line-height:1.6;font-size:14px;color:#f8fafc;'>" + communityChestCards[communityChestIndex].text + "</div>", function() {
				if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
					MONOPOLY_ONLINE.broadcastCardAction('communityChest', communityChestIndex);
				}
				communityChestAction(communityChestIndex);
			});
		} else {
			if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
				MONOPOLY_ONLINE.broadcastCardAction('communityChest', communityChestIndex);
			}
			setTimeout(function() {
				communityChestAction(communityChestIndex);
			}, 600);
		}

	} else if (p.position === 7 || p.position === 22 || p.position === 36) {
		if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline && !isLocalTurn) {
			return;
		}

		var chanceIndex = chanceCards.deck[chanceCards.index];
		if (chanceIndex === 0) chanceCards.deck.splice(chanceCards.index, 1);
		chanceCards.index++;
		if (chanceCards.index >= chanceCards.deck.length) chanceCards.index = 0;

		if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
			MONOPOLY_ONLINE.broadcastCardDraw('chance', chanceIndex);
		}

		if (p.human) {
			popup("<div style='display:flex;align-items:center;gap:10px;margin-bottom:8px;'>" +
				"<img src='images/chance_icon.png' style='height: 42px; width: 22px;' />" +
				"<div style='font-weight: 900; font-size: 16px; color: #f59e0b;'>机会 (Chance)</div>" +
				"</div><div style='line-height:1.6;font-size:14px;color:#f8fafc;'>" + chanceCards[chanceIndex].text + "</div>", function() {
				if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
					MONOPOLY_ONLINE.broadcastCardAction('chance', chanceIndex);
				}
				chanceAction(chanceIndex);
			});
		} else {
			if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
				MONOPOLY_ONLINE.broadcastCardAction('chance', chanceIndex);
			}
			setTimeout(function() {
				chanceAction(chanceIndex);
			}, 600);
		}
	} else {
		if (shouldRunAi(p)) {
			p.AI.alertList = "";
			if (!p.AI.onLand()) {
				game.next();
			}
		}
	}
}

function chanceAction(chanceIndex) {
	var p = player[turn];
	chanceCards[chanceIndex].action(p);
	updateMoney();
	if (shouldRunAi(p)) {
		p.AI.alertList = "";
		if (!p.AI.onLand()) {
			setTimeout(function() { game.next(); }, 500);
		}
	}
}

function communityChestAction(communityChestIndex) {
	var p = player[turn];
	communityChestCards[communityChestIndex].action(p);
	updateMoney();
	if (shouldRunAi(p)) {
		p.AI.alertList = "";
		if (!p.AI.onLand()) {
			setTimeout(function() { game.next(); }, 500);
		}
	}
}

function addamount(amount, cause) {
	var p = player[turn];
	p.money += amount;
	addAlert("玩家 " + p.name + " 因【" + cause + "】获得了 $" + amount + "。");
	if (window.AUDIO) window.AUDIO.play('win');
	updateMoney();
}

function subtractamount(amount, cause) {
	var p = player[turn];
	p.pay(amount, 0);
	addAlert("玩家 " + p.name + " 因【" + cause + "】支付了 $" + amount + "。");
	updateMoney();
}

function gotojail() {
	var p = player[turn];
	addAlert("玩家 " + p.name + " 被直接送入监狱服刑！");
	document.getElementById("landed").innerHTML = "你正在监狱中服刑。";

	p.jail = true;
	p.position = 10;
	doublecount = 0;
	window.doublecount = doublecount;
	document.getElementById("nextbutton").value = "结束回合 ⏭";

	if (p.human) document.getElementById("nextbutton").focus();
	updatePosition();
	updateOwned();

	if (shouldRunAi(p)) {
		p.AI.alertList = "";
		setTimeout(function() { game.next(); }, 600);
	}
}

function gobackthreespaces() {
	var p = player[turn];
	p.position -= 3;
	land();
}

function payeachplayer(amount, cause) {
	var p = player[turn];
	var total = 0;
	for (var i = 1; i <= pcount; i++) {
		if (i != turn) {
			player[i].money += amount;
			total += amount;
			var cred = p.money >= 0 ? i : p.creditor;
			p.pay(amount, cred);
		}
	}
	addAlert("玩家 " + p.name + " 因【" + cause + "】向每位其他玩家共计支付了 $" + total + "。");
}

function collectfromeachplayer(amount, cause) {
	var p = player[turn];
	var total = 0;
	for (var i = 1; i <= pcount; i++) {
		if (i != turn) {
			var money = player[i].money;
			if (money < amount) {
				p.money += money;
				total += money;
				player[i].money = 0;
			} else {
				player[i].pay(amount, turn);
				p.money += amount;
				total += amount;
			}
		}
	}
	addAlert("玩家 " + p.name + " 因【" + cause + "】向其他玩家共计收取了 $" + total + " 礼金。");
	if (window.AUDIO) window.AUDIO.play('win');
}

function advance(destination, pass) {
	var p = player[turn];
	if (typeof pass === "number") {
		if (p.position >= pass) {
			p.money += 200;
			addAlert("玩家 " + p.name + " 经过起点，领取了 $200 薪资！");
			if (window.AUDIO) window.AUDIO.play('drop');
		}
	}
	if (p.position > destination) {
		p.money += 200;
		addAlert("玩家 " + p.name + " 经过起点，领取了 $200 薪资！");
		if (window.AUDIO) window.AUDIO.play('drop');
	}
	p.position = destination;
	land();
}

function advanceToNearestUtility() {
	var p = player[turn];
	if (p.position < 12) advance(12);
	else if (p.position >= 12 && p.position < 28) advance(28);
	else advance(12);
}

function advanceToNearestRailroad() {
	var p = player[turn];
	if (p.position < 5) advance(5);
	else if (p.position >= 5 && p.position < 15) advance(15);
	else if (p.position >= 15 && p.position < 25) advance(25);
	else if (p.position >= 25 && p.position < 35) advance(35);
	else advance(5);
}

function streetrepairs(houseprice, hotelprice) {
	var cost = 0;
	for (var i = 0; i < 40; i++) {
		var s = square[i];
		if (s.owner == turn) {
			if (s.hotel == 1) cost += hotelprice;
			else cost += s.house * houseprice;
		}
	}
	var p = player[turn];
	if (cost > 0) {
		p.pay(cost, 0);
		addAlert("玩家 " + p.name + " 缴纳了名下房产翻修维护费共计 $" + cost + "。");
	}
}

function payfifty(fromNetwork) {
	var p = player[turn];
	var jailEl = document.getElementById("jail");
	if (jailEl) jailEl.style.border = '1.5px solid rgba(255,255,255,0.3)';

	$("#landed").hide();
	doublecount = 0;
	p.jail = false;
	p.jailroll = 0;
	p.position = 10;
	p.pay(50, 0);

	if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline && !fromNetwork) {
		MONOPOLY_ONLINE.broadcastBail(false);
	}

	addAlert("玩家 " + p.name + " 支付了 $50 保释金，重获自由！");
	updateMoney();
	updatePosition();
}

function useJailCard(fromNetwork) {
	var p = player[turn];
	var jailEl = document.getElementById("jail");
	if (jailEl) jailEl.style.border = '1.5px solid rgba(255,255,255,0.3)';

	$("#landed").hide();
	p.jail = false;
	p.jailroll = 0;
	p.position = 10;
	doublecount = 0;

	if (p.communityChestJailCard) {
		p.communityChestJailCard = false;
		communityChestCards.deck.push(0);
	} else if (p.chanceJailCard) {
		p.chanceJailCard = false;
		chanceCards.deck.push(0);
	}

	if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline && !fromNetwork) {
		MONOPOLY_ONLINE.broadcastBail(true);
	}

	addAlert("玩家 " + p.name + " 使用了【免费出狱卡】，立即出狱！");
	updateOwned();
	updatePosition();
}

function buyHouse(index, fromNetwork) {
	var sq = square[index];
	var p = player[sq.owner];
	var houseSum = 0, hotelSum = 0;

	if (p.money - sq.houseprice < 0) return false;

	for (var i = 0; i < 40; i++) {
		if (square[i].hotel === 1) hotelSum++;
		else houseSum += square[i].house;
	}

	if (sq.house < 4) {
		if (houseSum >= 32) return false;
		sq.house++;
		addAlert("玩家 " + p.name + " 在【" + sq.name + "】建造了 1 套房屋。");
	} else {
		if (hotelSum >= 12) return false;
		sq.house = 5;
		sq.hotel = 1;
		addAlert("玩家 " + p.name + " 在【" + sq.name + "】升级建成了豪华酒店！");
	}

	p.pay(sq.houseprice, 0);

	if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline && !fromNetwork) {
		MONOPOLY_ONLINE.broadcastBuild(index);
	}

	if (window.AUDIO) window.AUDIO.play('card_play');

	updateOwned();
	updateMoney();
}

function sellHouse(index, fromNetwork) {
	var sq = square[index];
	var p = player[sq.owner];

	if (sq.hotel === 1) {
		sq.hotel = 0;
		sq.house = 4;
		addAlert("玩家 " + p.name + " 拆售了【" + sq.name + "】的豪华酒店。");
	} else {
		sq.house--;
		addAlert("玩家 " + p.name + " 拆售了【" + sq.name + "】的一套房屋。");
	}

	p.money += sq.houseprice * 0.5;

	if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline && !fromNetwork) {
		MONOPOLY_ONLINE.broadcastSell(index);
	}

	updateOwned();
	updateMoney();
}

function showStats() {
	var HTML = "<div style='font-size:18px;font-weight:900;margin-bottom:12px;color:#38bdf8;'>📊 玩家资产全景总览</div><table style='width:100%;border-collapse:collapse;'>";
	HTML += "<tr style='background:rgba(255,255,255,0.08);color:#94a3b8;font-size:12px;'><th style='padding:6px;text-align:left;'>玩家</th><th style='padding:6px;'>现金</th><th style='padding:6px;'>房产地皮</th><th style='padding:6px;'>建筑 (房/店)</th><th style='padding:6px;'>出狱卡</th></tr>";

	for (var x = 1; x <= pcount; x++) {
		var p = player[x];
		var propNames = [];
		var houses = 0, hotels = 0;

		for (var i = 0; i < 40; i++) {
			var sq = square[i];
			if (sq.owner === x) {
				propNames.push(sq.name + (sq.mortgage ? "(抵押)" : ""));
				if (sq.hotel) hotels++;
				else houses += sq.house;
			}
		}

		var cardText = (p.communityChestJailCard ? "命运 " : "") + (p.chanceJailCard ? "机会" : "");
		if (!cardText) cardText = "-";

		HTML += "<tr style='border-bottom:1px solid rgba(255,255,255,0.08);font-size:12px;'>" +
			"<td style='padding:8px 6px;text-align:left;font-weight:bold;color:" + p.color + ";'>" + p.name + "</td>" +
			"<td style='padding:8px 6px;font-weight:bold;color:#10b981;'>$" + p.money + "</td>" +
			"<td style='padding:8px 6px;max-width:180px;font-size:11px;color:#cbd5e1;'>" + (propNames.length ? propNames.join("、") : "无") + "</td>" +
			"<td style='padding:8px 6px;'>" + (houses ? "🏠x" + houses + " " : "") + (hotels ? "🏨x" + hotels : (houses ? "" : "-")) + "</td>" +
			"<td style='padding:8px 6px;color:#38bdf8;'>" + cardText + "</td>" +
			"</tr>";
	}
	HTML += "</table>";

	document.getElementById("statstext").innerHTML = HTML;
	$("#statsbackground").fadeIn(250, function() {
		$("#statswrap").show();
	});
}

function showdeed(property, e) {
	var sq = square[property];
	if (!sq) return;
	var deedEl = document.getElementById("deed");
	if (!deedEl) return;

	$("#deed").show();
	$("#deed-normal, #deed-mortgaged, #deed-special").hide();

	if (e && typeof e.clientX === "number") {
		var deedW = 240, deedH = 280;
		var x = e.clientX + 14;
		var y = e.clientY + 14;
		if (x + deedW > window.innerWidth) x = e.clientX - deedW - 14;
		if (y + deedH > window.innerHeight) y = Math.max(10, window.innerHeight - deedH - 10);
		deedEl.style.left = Math.max(10, x) + "px";
		deedEl.style.top = Math.max(10, y) + "px";
	} else if (!deedEl.style.left || deedEl.style.left === "0px" || deedEl.style.left === "") {
		deedEl.style.left = Math.max(10, Math.round((window.innerWidth - 240) / 2)) + "px";
		deedEl.style.top = Math.max(60, Math.round((window.innerHeight - 280) / 2)) + "px";
	}

	if (sq.mortgage) {
		$("#deed-mortgaged").show();
		document.getElementById("deed-mortgaged-name").textContent = sq.name;
		document.getElementById("deed-mortgaged-mortgage").textContent = (sq.price / 2);
	} else {
		if (sq.groupNumber >= 3) {
			$("#deed-normal").show();
			document.getElementById("deed-header").style.backgroundColor = sq.color;
			document.getElementById("deed-name").textContent = sq.name;
			document.getElementById("deed-baserent").textContent = sq.baserent;
			document.getElementById("deed-rent1").textContent = sq.rent1;
			document.getElementById("deed-rent2").textContent = sq.rent2;
			document.getElementById("deed-rent3").textContent = sq.rent3;
			document.getElementById("deed-rent4").textContent = sq.rent4;
			document.getElementById("deed-rent5").textContent = sq.rent5;
			document.getElementById("deed-mortgage").textContent = (sq.price / 2);
			document.getElementById("deed-houseprice").textContent = sq.houseprice;
			document.getElementById("deed-hotelprice").textContent = sq.houseprice;
		} else if (sq.groupNumber == 2) {
			$("#deed-special").show();
			document.getElementById("deed-special-name").textContent = sq.name;
			document.getElementById("deed-special-text").innerHTML = utiltext();
			document.getElementById("deed-special-mortgage").textContent = (sq.price / 2);
		} else if (sq.groupNumber == 1) {
			$("#deed-special").show();
			document.getElementById("deed-special-name").textContent = sq.name;
			document.getElementById("deed-special-text").innerHTML = transtext();
			document.getElementById("deed-special-mortgage").textContent = (sq.price / 2);
		}
	}
}

function hidedeed() {
	$("#deed").hide();
}

function buy(fromNetwork) {
	var p = player[turn];
	var property = square[p.position];
	var cost = property.price;

	if (p.money >= cost) {
		p.pay(cost, 0);
		property.owner = turn;
		updateMoney();
		addAlert("玩家 " + p.name + " 以 " + property.pricetext + " 购买了【" + property.name + "】！");

		if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline && !fromNetwork) {
			MONOPOLY_ONLINE.broadcastBuy(p.position);
		}

		if (window.AUDIO) window.AUDIO.play('card_play');
		updateOwned();
		$("#landed").hide();
	} else {
		popup("<p>资金不足！玩家 " + p.name + " 还差 $" + (property.price - p.money) + " 才能购买【" + property.name + "】。</p>");
	}
}

function mortgage(index, fromNetwork) {
	var sq = square[index];
	var p = player[sq.owner];

	if (sq.house > 0 || sq.hotel > 0 || sq.mortgage) return false;

	var mortgagePrice = Math.round(sq.price * 0.5);
	sq.mortgage = true;
	p.money += mortgagePrice;

	if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline && !fromNetwork) {
		MONOPOLY_ONLINE.broadcastMortgage(index, 'mortgage');
	}

	addAlert("玩家 " + p.name + " 抵押了【" + sq.name + "】，获得抵押款 $" + mortgagePrice + "。");
	updateOwned();
	updateMoney();
	return true;
}

function unmortgage(index, fromNetwork) {
	var sq = square[index];
	var p = player[sq.owner];
	var unmortgagePrice = Math.round(sq.price * 0.55);

	if (unmortgagePrice > p.money || !sq.mortgage) return false;

	p.pay(unmortgagePrice, 0);
	sq.mortgage = false;

	if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline && !fromNetwork) {
		MONOPOLY_ONLINE.broadcastMortgage(index, 'unmortgage');
	}

	addAlert("玩家 " + p.name + " 支付 $" + unmortgagePrice + " 赎回了【" + sq.name + "】。");
	updateOwned();
	updateMoney();
	return true;
}

function land(increasedRent) {
	increasedRent = !!increasedRent;
	var p = player[turn];
	var s = square[p.position];
	var die1 = game.getDie(1);
	var die2 = game.getDie(2);

	$("#landed").show();
	document.getElementById("landed").innerHTML = "你到达了【" + s.name + "】。";
	s.landcount++;
	addAlert("玩家 " + p.name + " 到达了【" + s.name + "】。");

	// 允许玩家购买停留的地产
	if (s.price !== 0 && s.owner === 0) {
		if (!p.human) {
			if (shouldRunAi(p) && p.AI && p.AI.buyProperty(p.position)) {
				buy();
			}
		} else {
			var isLocalTurn = true;
			if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
				isLocalTurn = (turn === MONOPOLY_ONLINE.state.mySlot);
			}
			if (isLocalTurn) {
				document.getElementById("landed").innerHTML = "<div>你到达了 <a href='javascript:void(0);' onmouseover='showdeed(" + p.position + ");' onmouseout='hidedeed();' class='statscellcolor' style='color:#38bdf8;text-decoration:none;font-weight:bold;'>【" + s.name + "】</a>。" +
					"<input type='button' class='btn-action' onclick='buy();' value='购买地皮 (" + s.pricetext + ")' style='margin-left:8px;' /></div>";
			} else {
				document.getElementById("landed").innerHTML = "<div>玩家【" + p.name + "】到达了 <a href='javascript:void(0);' onmouseover='showdeed(" + p.position + ");' onmouseout='hidedeed();' class='statscellcolor' style='color:#38bdf8;text-decoration:none;font-weight:bold;'>【" + s.name + "】</a>，正在考虑是否购买...</div>";
			}
		}
		game.addPropertyToAuctionQueue(p.position);
	}

	// 收取租金
	if (s.owner !== 0 && s.owner != turn && !s.mortgage) {
		var groupowned = true;
		var rent;

		if (p.position == 5 || p.position == 15 || p.position == 25 || p.position == 35) {
			rent = increasedRent ? 25 : 12.5;
			if (s.owner == square[5].owner) rent *= 2;
			if (s.owner == square[15].owner) rent *= 2;
			if (s.owner == square[25].owner) rent *= 2;
			if (s.owner == square[35].owner) rent *= 2;

		} else if (p.position === 12 || p.position === 28) {
			if (increasedRent || square[12].owner == square[28].owner) {
				rent = (die1 + die2) * 10;
			} else {
				rent = (die1 + die2) * 4;
			}

		} else {
			for (var i = 0; i < 40; i++) {
				var sq = square[i];
				if (sq.groupNumber == s.groupNumber && sq.owner != s.owner) {
					groupowned = false;
				}
			}
			if (!groupowned) {
				rent = s.baserent;
			} else {
				rent = (s.house === 0) ? (s.baserent * 2) : s["rent" + s.house];
			}
		}

		addAlert("玩家 " + p.name + " 向 玩家 " + player[s.owner].name + " 支付了 $" + rent + " 过路租金。");
		p.pay(rent, s.owner);
		player[s.owner].money += rent;

		var isLocalTurn = true;
		if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
			isLocalTurn = (turn === MONOPOLY_ONLINE.state.mySlot);
		}
		if (isLocalTurn) {
			document.getElementById("landed").innerHTML = "你到达了【" + s.name + "】。玩家 " + player[s.owner].name + " 向你收取了 $" + rent + " 过路租金。";
		} else {
			document.getElementById("landed").innerHTML = "玩家【" + p.name + "】到达了【" + s.name + "】，向 玩家 " + player[s.owner].name + " 支付了 $" + rent + " 过路租金。";
		}
		if (window.AUDIO) window.AUDIO.play('slice');

	} else if (s.owner > 0 && s.owner != turn && s.mortgage) {
		document.getElementById("landed").innerHTML = "到达了【" + s.name + "】。该地产处于抵押中，免收过路费。";
	}

	if (p.position === 4) citytax();
	if (p.position === 30) {
		updateMoney();
		updatePosition();
		var isLocalTurn = true;
		if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
			isLocalTurn = (turn === MONOPOLY_ONLINE.state.mySlot);
		}
		if (p.human && isLocalTurn) popup("<div>直接前往监狱！不得经过起点，不领 $200 薪资。</div>", gotojail);
		else gotojail();
		return;
	}
	if (p.position === 38) luxurytax();

	updateMoney();
	updatePosition();
	updateOwned();

	if (!p.human && p.AI) {
		if (shouldRunAi(p)) {
			chanceCommunityChest();
		}
	} else {
		chanceCommunityChest();
	}
}

function roll(forcedDie1, forcedDie2, fromNetwork) {
	var p = player[turn];

	if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline && !fromNetwork) {
		var isMyTurn = (turn === MONOPOLY_ONLINE.state.mySlot);
		var isAi = !p.human;
		if (!isMyTurn && !(isAi && MONOPOLY_ONLINE.state.myRole === 'host')) {
			return;
		}
	}

	$("#option, #manage").hide();
	$("#buy").show();

	if (p.human) {
		document.getElementById("nextbutton").focus();
	}
	document.getElementById("nextbutton").value = "结束回合 ⏭";

	if (forcedDie1 && forcedDie2) {
		game.setDice(forcedDie1, forcedDie2);
	} else {
		game.rollDice();
	}

	var die1 = game.getDie(1);
	var die2 = game.getDie(2);

	if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline && !fromNetwork) {
		MONOPOLY_ONLINE.broadcastRoll(die1, die2);
	}

	doublecount++;

	// 播放骰子滚动动画与拟真音效
	var el0 = document.getElementById("die0");
	var el1 = document.getElementById("die1");
	if (el0) el0.classList.add("rolling");
	if (el1) el1.classList.add("rolling");

	if (window.AUDIO) window.AUDIO.play('dice_roll');

	setTimeout(function() {
		if (el0) el0.classList.remove("rolling");
		if (el1) el1.classList.remove("rolling");
		if (window.AUDIO) window.AUDIO.play('cup_slam');
	}, 350);

	if (die1 == die2) {
		addAlert("玩家 " + p.name + " 掷出了 " + (die1 + die2) + " 点（双数点）！");
	} else {
		addAlert("玩家 " + p.name + " 掷出了 " + (die1 + die2) + " 点。");
	}

	if (die1 == die2 && !p.jail) {
		updateDice(die1, die2);
		if (doublecount < 3) {
			document.getElementById("nextbutton").value = "🎲 双数点！再掷一次";
		} else if (doublecount === 3) {
			p.jail = true;
			doublecount = 0;
			window.doublecount = doublecount;
			addAlert("玩家 " + p.name + " 连续 3 次掷出双数点，涉嫌违规被押送监狱！");
			updateMoney();
			var isLocalTurn = true;
			if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
				isLocalTurn = (turn === MONOPOLY_ONLINE.state.mySlot);
			}
			if (p.human && isLocalTurn) popup("你连续 3 次掷出双数点，涉嫌违规，必须立即前往监狱！", gotojail);
			else gotojail();
			return;
		}
	} else {
		document.getElementById("nextbutton").value = "结束回合 ⏭";
		doublecount = 0;
		window.doublecount = doublecount;
	}

	updatePosition();
	updateMoney();
	updateOwned();

	if (p.jail === true) {
		p.jailroll++;
		updateDice(die1, die2);

		if (die1 == die2) {
			p.jail = false;
			p.jailroll = 0;
			p.position = 10 + die1 + die2;
			doublecount = 0;
			window.doublecount = doublecount;
			addAlert("玩家 " + p.name + " 掷出双数点，成功破除监狱！");
			land();
		} else {
			if (p.jailroll === 3) {
				if (p.human) {
					var isLocalTurn = true;
					if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
						isLocalTurn = (turn === MONOPOLY_ONLINE.state.mySlot);
					}
					if (isLocalTurn) {
						popup("<p>服刑期满 3 次，必须缴纳 $50 罚金出狱。</p>", function() {
							payfifty();
							player[turn].position = 10 + die1 + die2;
							land();
						});
					} else {
						payfifty();
						player[turn].position = 10 + die1 + die2;
						land();
					}
				} else {
					payfifty();
					p.position = 10 + die1 + die2;
					land();
				}
			} else {
				$("#landed").show();
				var isLocalTurn = true;
				if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
					isLocalTurn = (turn === MONOPOLY_ONLINE.state.mySlot);
				}
				if (isLocalTurn) {
					document.getElementById("landed").innerHTML = "你正在监狱中服刑。";
				} else {
					document.getElementById("landed").innerHTML = "玩家【" + p.name + "】正在监狱中服刑。";
				}
				if (shouldRunAi(p)) {
					p.AI.alertList = "";
					setTimeout(function() { game.next(); }, 600);
				}
			}
		}
	} else {
		updateDice(die1, die2);
		p.position += die1 + die2;

		if (p.position >= 40) {
			p.position -= 40;
			p.money += 200;
			addAlert("玩家 " + p.name + " 经过或到达【起点】，领取了 $200 薪资！");
			if (window.AUDIO) window.AUDIO.play('drop');
		}

		land();
	}
}

function play(fromNetwork) {
	if (game.auction()) return;

	turn++;
	if (turn > pcount) {
		turn -= pcount;
	}
	window.turn = turn;

	var p = player[turn];
	game.resetDice();

	document.getElementById("pname").innerHTML = p.name + " 的回合";
	addAlert("现在轮到 玩家 " + p.name + " 的回合。");

	p.pay(0, p.creditor);

	$("#landed, #option, #manage").hide();
	$("#board-container, #control, #buy").show();

	doublecount = 0;
	window.doublecount = doublecount;

	if (p.human) {
		document.getElementById("nextbutton").focus();
	}
	document.getElementById("nextbutton").value = "🎲 掷骰子";

	$("#die0, #die1").hide();

	var isLocalTurn = true;
	if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
		isLocalTurn = (turn === MONOPOLY_ONLINE.state.mySlot);
	}

	if (p.jail) {
		$("#landed").show();
		if (isLocalTurn) {
			document.getElementById("landed").innerHTML = "你正在监狱服刑。<input type='button' class='btn-action' value='支付 $50 保释出狱' onclick='payfifty();' style='margin-left:8px;' />";

			if (p.communityChestJailCard || p.chanceJailCard) {
				document.getElementById("landed").innerHTML += "<input type='button' class='btn-action' id='gojfbutton' value='使用免罪卡' onclick='useJailCard();' style='margin-left:6px;' />";
			}
		} else {
			document.getElementById("landed").innerHTML = "玩家【" + p.name + "】正在监狱服刑。";
		}

		if (p.jailroll === 0) addAlert("这是 玩家 " + p.name + " 在监狱中的第 1 回合。");
		else if (p.jailroll === 1) addAlert("这是 玩家 " + p.name + " 在监狱中的第 2 回合。");
		else if (p.jailroll === 2) {
			if (isLocalTurn) {
				document.getElementById("landed").innerHTML += "<div>提示：本次若未掷出双数点，必须强制缴纳 $50 出狱。</div>";
			}
			addAlert("这是 玩家 " + p.name + " 在监狱中的第 3 回合。");
		}

		if (shouldRunAi(p) && p.AI.postBail()) {
			if (p.communityChestJailCard || p.chanceJailCard) useJailCard();
			else payfifty();
		}
	}

	updateMoney();
	updatePosition();
	updateOwned();

	if (window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline) {
		MONOPOLY_ONLINE.updateTurnControls();
	}

	if (shouldRunAi(p)) {
		setTimeout(function() {
			if (!p.AI.beforeTurn()) game.next();
		}, window.MONOPOLY_ONLINE && MONOPOLY_ONLINE.state.isOnline ? 600 : 400);
	}
}

function setup() {
	pcount = parseInt(document.getElementById("playernumber").value, 10);
	window.pcount = pcount;
	if (typeof globalThis !== 'undefined') globalThis.pcount = pcount;
	turn = 0;
	doublecount = 0;
	window.turn = 0;
	window.doublecount = 0;

	var playerArray = new Array(pcount);

	for (var i = 0; i < pcount; i++) {
		playerArray[i] = i + 1;
	}

	for (var i = 1; i <= pcount; i++) {
		var p = player[i];
		var colorEl = document.getElementById("player" + i + "color");
		p.color = colorEl ? colorEl.value.toLowerCase() : '#38bdf8';

		var aiEl = document.getElementById("player" + i + "ai");
		var nameEl = document.getElementById("player" + i + "name");

		if (aiEl && aiEl.value === "0") {
			p.name = nameEl ? nameEl.value : ("玩家 " + i);
			p.human = true;
		} else {
			p.name = nameEl ? nameEl.value : ("电脑 AI " + i);
			p.human = false;
			p.AI = new AITest(p);
		}
	}

	$("#board-container, #control").show();
	$("#setup").hide();

	resizeBoard();
	play();
}

function getCheckedProperty() {
	for (var i = 0; i < 42; i++) {
		var el = document.getElementById("propertycheckbox" + i);
		if (el && el.checked) return i;
	}
	return -1;
}

function playernumber_onchange() {
	pcount = parseInt(document.getElementById("playernumber").value, 10);
	$(".player-input").hide();
	for (var i = 1; i <= pcount; i++) {
		$("#player" + i + "input").show();
	}
}

function resizeBoard() {
	var container = document.getElementById("board-container");
	var boardWrap = document.getElementById("board-wrapper");
	if (!container || !boardWrap) return;

	var availW = Math.min(window.innerWidth - 20, 720);
	var availH = window.innerHeight - 100;
	var targetSize = Math.max(280, Math.min(availW, availH, 660));

	var scale = targetSize / 660;
	boardWrap.style.transform = "scale(" + scale + ")";
	container.style.width = targetSize + "px";
	container.style.height = targetSize + "px";
}

window.startOnlineMonopolyGame = function(playerList, count) {
	pcount = count;
	window.pcount = pcount;
	if (typeof globalThis !== 'undefined') globalThis.pcount = pcount;
	turn = 0;
	doublecount = 0;
	window.turn = 0;
	window.doublecount = 0;

	for (var i = 1; i <= count; i++) {
		var p = player[i];
		var data = playerList[i - 1];
		p.name = data.name;
		p.color = data.color;
		p.human = !data.isAi;
		if (data.isAi) {
			p.AI = new AITest(p);
		}
	}

	$("#board-container, #control").show();
	$("#setup").hide();

	resizeBoard();
	play();
};

window.executeOnlineRoll = function(d1, d2) { roll(d1, d2, true); };
window.executeOnlineBuy = function(propIdx) { buy(true); };
window.executeOnlineBuild = function(propIdx) { buyHouse(propIdx, true); };
window.executeOnlineSell = function(propIdx) { sellHouse(propIdx, true); };
window.executeOnlineMortgage = function(propIdx, action) {
	if (action === 'mortgage') mortgage(propIdx, true);
	else unmortgage(propIdx, true);
};
window.executeOnlineBail = function(useCard) {
	if (useCard) useJailCard(true);
	else payfifty(true);
};
window.executeOnlineEndTurn = function() { play(true); };
window.executeOnlineResign = function() { game.bankruptcy(true); };

window.executeOnlineCardDraw = function(deck, index) {
	var p = player[turn];
	var card = deck === 'chance' ? chanceCards[index] : communityChestCards[index];
	var deckName = deck === 'chance' ? '机会卡' : '命运宝箱';
	addAlert("玩家 " + p.name + " 抽取了【" + deckName + "】：" + (card ? card.text : ''));
	if (window.showToast) window.showToast("玩家【" + p.name + "】抽中【" + deckName + "】");
};

window.executeOnlineCardAction = function(deck, index) {
	if (deck === 'chance') {
		chanceAction(index);
	} else {
		communityChestAction(index);
	}
};

window.applyOnlineSyncState = function(stateData) {
	if (!stateData) return;
	if (stateData.pcount) {
		pcount = stateData.pcount;
		window.pcount = pcount;
		if (typeof globalThis !== 'undefined') globalThis.pcount = pcount;
	}
	if (typeof stateData.turn === 'number') {
		turn = stateData.turn;
		window.turn = turn;
		if (typeof globalThis !== 'undefined') globalThis.turn = turn;
	}
	if (typeof stateData.doublecount === 'number') {
		doublecount = stateData.doublecount;
		window.doublecount = doublecount;
		if (typeof globalThis !== 'undefined') globalThis.doublecount = doublecount;
	}
	if (stateData.players) {
		stateData.players.forEach(function(pd) {
			var p = player[pd.index];
			if (p) {
				p.money = pd.money;
				p.position = pd.position;
				p.jail = pd.jail;
				p.jailroll = pd.jailroll;
				p.communityChestJailCard = pd.communityChestJailCard;
				p.chanceJailCard = pd.chanceJailCard;
			}
		});
	}
	if (stateData.squares) {
		stateData.squares.forEach(function(sd) {
			var sq = square[sd.index];
			if (sq) {
				sq.owner = sd.owner;
				sq.house = sd.house;
				sq.hotel = sd.hotel;
				sq.mortgage = sd.mortgage;
			}
		});
	}
	updateMoney();
	updatePosition();
	updateOwned();
	if (window.MONOPOLY_ONLINE) {
		MONOPOLY_ONLINE.updateTurnControls();
	}
};

window.executeOnlineTradePropose = function(tradeData) {
	var initP = player[tradeData.initiator];
	var recipP = player[tradeData.recipient];
	if (!initP || !recipP) return;

	var tradeObj = new Trade(initP, recipP, tradeData.money, tradeData.property, tradeData.communityChestJailCard, tradeData.chanceJailCard);
	game.trade(tradeObj);

	var reversedProp = [];
	for (var i = 0; i < 40; i++) {
		reversedProp[i] = -tradeObj.getProperty(i);
	}
	var reversedTrade = new Trade(recipP, initP, -tradeData.money, reversedProp, 0, 0);
	writeTrade(reversedTrade);

	$("#proposetradebutton, #canceltradebutton").hide();
	$("#accepttradebutton, #rejecttradebutton").show();

	popup("<p>玩家【" + initP.name + "】向你发起了商业资产交易提案！<br/>请核对出让与索取资产，点击接受或拒绝：</p>");
};

window.executeOnlineTradeResp = function(accept) {
	if (accept) {
		popup("<p>🎉 交易达成！对方已同意并签署了商业资产置换协议！</p>");
		game.acceptTrade();
	} else {
		popup("<p>对方拒绝了本次资产交易提案。</p>");
		game.cancelTrade();
	}
};

window.onload = function() {
	game = new Game();
	if (typeof window !== 'undefined') window.game = game;
	if (typeof globalThis !== 'undefined') globalThis.game = game;

	for (var i = 0; i <= 8; i++) {
		player[i] = new Player("", "");
		player[i].index = i;
	}

	var groupPropertyArray = [];
	for (var i = 0; i < 40; i++) {
		var groupNumber = square[i].groupNumber;
		if (groupNumber > 0) {
			if (!groupPropertyArray[groupNumber]) groupPropertyArray[groupNumber] = [];
			groupPropertyArray[groupNumber].push(i);
		}
	}

	for (var i = 0; i < 40; i++) {
		var groupNumber = square[i].groupNumber;
		if (groupNumber > 0) square[i].group = groupPropertyArray[groupNumber];
		square[i].index = i;
	}

	AITest.count = 0;
	player[1].human = true;
	player[0].name = "银行系统";

	communityChestCards.index = 0;
	chanceCards.index = 0;
	communityChestCards.deck = [];
	chanceCards.deck = [];

	for (var i = 0; i < 16; i++) {
		chanceCards.deck[i] = i;
		communityChestCards.deck[i] = i;
	}

	chanceCards.deck.sort(function() { return Math.random() - 0.5; });
	communityChestCards.deck.sort(function() { return Math.random() - 0.5; });

	$("#playernumber").on("change", playernumber_onchange);
	playernumber_onchange();

	$("#nextbutton").click(function() { game.next(); });
	$("#noscript").hide();
	$("#setup").show();

	// 构建棋盘格内部元素
	for (var i = 0; i < 40; i++) {
		var s = square[i];
		var currentCell = document.getElementById("cell" + i);
		if (!currentCell) continue;

		var currentCellAnchor = currentCell.appendChild(document.createElement("div"));
		currentCellAnchor.id = "cell" + i + "anchor";
		currentCellAnchor.className = "cell-anchor";

		var currentCellPositionHolder = currentCellAnchor.appendChild(document.createElement("div"));
		currentCellPositionHolder.id = "cell" + i + "positionholder";
		currentCellPositionHolder.className = "cell-position-holder";
		currentCellPositionHolder.enlargeId = "enlarge" + i;

		var currentCellName = currentCellAnchor.appendChild(document.createElement("div"));
		currentCellName.id = "cell" + i + "name";
		currentCellName.className = "cell-name";
		currentCellName.textContent = s.name;

		if (square[i].groupNumber) {
			var currentCellOwner = currentCellAnchor.appendChild(document.createElement("div"));
			currentCellOwner.id = "cell" + i + "owner";
			currentCellOwner.className = "cell-owner";
		}
	}

	corrections();

	// 监狱地格校准
	var jailEl = document.getElementById("jail");
	if (jailEl) {
		$("<div>", {id: "jailpositionholder" }).appendTo("#jail");
		$("<span>").text("探监 / 服刑").appendTo("#jail");
	}

	// 鼠标悬停放大与地契预览跟随
	$(document).on("mousemove", function(e) {
		var deedEl = document.getElementById("deed");
		if (!deedEl || deedEl.style.display === "none") return;
		var deedW = 240, deedH = 280;
		var x = e.clientX + 14;
		var y = e.clientY + 14;
		if (x + deedW > window.innerWidth) x = e.clientX - deedW - 14;
		if (y + deedH > window.innerHeight) y = Math.max(10, window.innerHeight - deedH - 10);
		deedEl.style.left = Math.max(8, x) + "px";
		deedEl.style.top = Math.max(8, y) + "px";
	});

	$(".cell").on("mouseover", function(e) {
		var cellId = this.id.replace("cell", "");
		var idx = parseInt(cellId, 10);
		if (!isNaN(idx)) showdeed(idx, e);
	}).on("mouseout", function() {
		hidedeed();
	});

	$("#deed").on("click", hidedeed);

	$("#mortgagebutton").click(function() {
		var checkedProperty = getCheckedProperty();
		var s = square[checkedProperty];
		if (!s) return;

		if (s.mortgage) {
			if (player[s.owner].money < Math.round(s.price * 0.55)) {
				popup("<p>资金不足！还需要 $" + (Math.round(s.price * 0.55) - player[s.owner].money) + " 才能赎回【" + s.name + "】。</p>");
			} else {
				popup("<p>确定要支付 $" + Math.round(s.price * 0.55) + " 赎回【" + s.name + "】吗？</p>", function() {
					unmortgage(checkedProperty);
				}, "Yes/No");
			}
		} else {
			popup("<p>确定要抵押【" + s.name + "】以获取 $" + Math.round(s.price * 0.5) + " 现金吗？</p>", function() {
				mortgage(checkedProperty);
			}, "Yes/No");
		}
	});

	$("#buyhousebutton").on("click", function() {
		var checkedProperty = getCheckedProperty();
		var s = square[checkedProperty];
		if (!s) return;
		var p = player[s.owner];

		if (p.money < s.houseprice) {
			popup("<p>资金不足！还需要 $" + (s.houseprice - p.money) + " 才能加建建筑。</p>");
			return;
		}

		buyHouse(checkedProperty);
	});

	$("#sellhousebutton").click(function() {
		sellHouse(getCheckedProperty());
	});

	$("#viewstats").on("click", showStats);
	$("#statsclose, #statsbackground").on("click", function() {
		$("#statswrap").hide();
		$("#statsbackground").fadeOut(250);
	});

	$("#buy-menu-item").click(function() {
		$("#buy").show();
		$("#manage").hide();
		$("#alert").scrollTop($("#alert").prop("scrollHeight"));
	});

	$("#manage-menu-item").click(function() {
		$("#manage").show();
		$("#buy").hide();
	});

	$("#trade-menu-item").click(game.trade);

	// 初始化在线联机网络模块
	if (window.MONOPOLY_ONLINE) {
		MONOPOLY_ONLINE.init();
	}

	if (typeof window !== 'undefined' && window.addEventListener) {
		window.addEventListener("resize", resizeBoard);
	}
	resizeBoard();
};

if (typeof globalThis !== 'undefined') {
	globalThis.player = player;
	globalThis.pcount = pcount;
	globalThis.turn = turn;
	globalThis.doublecount = doublecount;
	globalThis.game = game;
	globalThis.Game = Game;
	globalThis.Player = Player;
	globalThis.Trade = Trade;
	globalThis.setup = setup;
	globalThis.play = play;
	globalThis.roll = roll;
	globalThis.buy = buy;
	globalThis.buyHouse = buyHouse;
	globalThis.sellHouse = sellHouse;
	globalThis.mortgage = mortgage;
	globalThis.unmortgage = unmortgage;
	globalThis.payfifty = payfifty;
	globalThis.useJailCard = useJailCard;
	globalThis.gotojail = gotojail;
	globalThis.addamount = addamount;
	globalThis.subtractamount = subtractamount;
	globalThis.advance = advance;
	globalThis.gobackthreespaces = gobackthreespaces;
	globalThis.advanceToNearestUtility = advanceToNearestUtility;
	globalThis.advanceToNearestRailroad = advanceToNearestRailroad;
	globalThis.payeachplayer = payeachplayer;
	globalThis.collectfromeachplayer = collectfromeachplayer;
	globalThis.streetrepairs = streetrepairs;
	globalThis.chanceCommunityChest = chanceCommunityChest;
	globalThis.chanceAction = chanceAction;
	globalThis.communityChestAction = communityChestAction;
	globalThis.updateMoney = updateMoney;
	globalThis.updatePosition = updatePosition;
	globalThis.updateOwned = updateOwned;
	globalThis.resizeBoard = resizeBoard;
	globalThis.showdeed = showdeed;
	globalThis.hidedeed = hidedeed;
	globalThis.showStats = showStats;
	globalThis.popup = popup;
	globalThis.addAlert = addAlert;
}
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		player, pcount, turn, doublecount, game, Game, Player, Trade,
		setup, play, roll, buy, buyHouse, sellHouse, mortgage, unmortgage,
		payfifty, useJailCard, gotojail, addamount, subtractamount, advance,
		gobackthreespaces, advanceToNearestUtility, advanceToNearestRailroad,
		payeachplayer, collectfromeachplayer, streetrepairs,
		chanceCommunityChest, chanceAction, communityChestAction,
		updateMoney, updatePosition, updateOwned, resizeBoard, showdeed, hidedeed,
		showStats, popup, addAlert
	};
}
