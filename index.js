/*
 * Before attending OIT, I started a personal project with the goal
 * of making a powerful web chat platform using javascript to mimic
 * a windowed environment. This is my proof-of-concept UI prototype.
 * This is now my senior project at OIT.
 *
 *  - Will Adams
 */
 
 /*
  * TRY IT LIVE IT AT http://66.190.237.88/
  * (this is not a functioning chat. it is just a UI demo)
  *
  * Try:
  *  - moving the chat window by dragging the active tab
  *  - rearranging tabs by dragging inactive tabs within their container
  *  - spawning new containers by dragging inactive tabs out of their container
  *  - merging containers by dragging an active tab into another container
  *  - resizing containers
  */

$(function() {
	initGlobals();
	
	// create some tabs for testing
	$("#outer_container").append(container_html);
	onInnerContainerCreate($(".inner_container"));
	activateLastTabs();
	createTabs($(".ui-tabs:last"), true, "Experimental", "Rocking", "Interface", "Another Tab");
	onInnerContainerChange($(".inner_container"));
});

// Calls .tabs() on the most recently appended set of tabs
// This will be called every time a new chat window is opened, to ensure they
// all function the same way
function activateLastTabs() {
	var $tabs = $(".ui-tabs:last");
	$tabs.tabs({
		beforeActivate: function (event, ui) {
			// ui.oldPanel, ui.oldTab, ui.newPanel, ui.newTab
			// ui.tab = "http://.../#tab"
			// ui.panel = target HTML div object
			// ui.index = tab number (independent jquery count)
			
			if (suppress_select) {
				suppress_select = false;
				return false;
			}
		},
		activate: function (event, ui) {
			var $inner_cont = ui.newPanel.parent().parent();
			var tab_id = "#" + ui.newPanel.attr("id");

			if (verbose_debugging)
				console.log("activating " + tab_id);

			// Attach chat window to currently-open tab for dragging
			var $handle = ui.newTab;

			// Remove old attachments
			if ($handle.data("uiDraggable"))
				$handle.draggable("destroy");

			$inner_cont.draggable({handle: $handle,
				start: function(event,ui) {
					// Keep on top of other containers
					innerContainerToFront($(ui.helper));
				},
				stop: function(event,ui) {
					// Prevent from being dragged off the screen
					draggableRepos(ui.helper,ui.offset);
				}
			});
			
			onTabChange($inner_cont);

			tab_lookup[tab_id].$tab_href.removeClass("unread");
			scrollDown(tab_id);
			tab_lookup[tab_id].$message_input.focus();
		}
	// Bring the new container to the foreground
	}).parent().css("z-index",current_z_index++);
	
	// 'Close tab' button
	$tabs.on("click", "span.ui-icon-closethick", function() { removeTab($(this).parent()); });
}

// Create any number of tabs and place them in the most recently made container
function createTabs(tab_div, add_chat_html)
{
	if (typeof tab_div == "undefined")
	{
		// hunting for a strange bug
		console.log("ui.panel undefined? MADNESS!");
	}

	for (var i = 2; i < arguments.length; i++)
	{
		// add tab
		$("<li><a href='#tabs-"+tab_counter+"'>"+arguments[i]+"</a> <span class='ui-icon ui-icon-closethick'>Remove Tab</span></li>")
			.appendTo($(tab_div).children(".ui-tabs-nav"));
		// add corresponding div
		$("<div id='tabs-"+tab_counter+"'></div>").appendTo(tab_div);

		if (add_chat_html)
		{
			var add_div = "#tabs-"+tab_counter;
			$(add_div).append(chat_html);
			addToTabLookup(add_div);
			tab_lookup[add_div].$chat_left.append("Room: "+arguments[i]+"<br />");
			tab_lookup[add_div].$chat_right.append("You<br />");
			tab_lookup[add_div].$chat_bottom_right.append("<br />");
		}

		tab_counter++;
	}
	$(tab_div).tabs("refresh");
	if (add_chat_html)
		$(tab_div).tabs("option","active",$(tab_div).children("div").length-1);

	// @todo logic check for PMs (and other?), where we do not want to be forcefully switched
}

// moveTab(). It moves tabs.
// @todo something in here causes a non-fatal error in IE
function moveTab($old_tab,$new_inner_cont) {
	if (verbose_debugging)
		console.log("moveTab() start");
	var $a = $old_tab.children("a");
	var old_tab_id = $a.attr("href");
	var new_tab_id = "#tabs-"+tab_counter;
	var $new_tab_div = $new_inner_cont.children(".ui-tabs");
	if (verbose_debugging) {
		console.log("old tab: ");
		console.log($old_tab);
		console.log("assigning "+tab_counter+" for new tab");
	}

	// Create the new tab, but without stock html - we have our own to use
	createTabs($new_tab_div, false, $a.text());

	// Detach the old tab's chat_container and put it with the new
	$(old_tab_id).children().detach().appendTo(new_tab_id);
	addToTabLookup(new_tab_id);
	onInnerContainerChange($new_inner_cont);

	// Now remove the old tab
	removeTab($old_tab);
	
	// If the new container already had tabs, we want to resize our moved tab's elements to match
	$new_divs = $new_inner_cont.find("div[id^='tabs-']");
	if ($new_divs.length > 1) {
		var copy_tab_id = "#"+$new_divs.eq(0).attr("id");
		copyTabDimensions(copy_tab_id,new_tab_id);
	}
	
	$new_tab_div.tabs("option", "active", $new_divs.length-1);

	if (verbose_debugging) {
		console.log("new tab: ");
		console.log($(new_tab_id));
		console.log("moveTab() end");
	}
}

function removeTab($tab_li) {
	if (verbose_debugging)
		console.log("removeTab()");
	
	var $tabs = $tab_li.parent().parent();
	var tab_id = $tab_li.children("a").attr("href");

	$(tab_id).remove();
	$tab_li.remove();
	$tabs.tabs("refresh");
	delete tab_lookup[tab_id];

	if ($tabs.children().length == 1)
	{
		// Only .ui-tabs-nav is left -- there are no more content divs
		$tabs.parent().remove();
		// @todo show menu if there are no containers left
	}
	else
	{
		onInnerContainerChange($tabs.parent());
	}
}

// onInnerContainerCreate: any code here needs to be run when the container is first created
function onInnerContainerCreate($inner_cont) {
	// Bring the window to the front and make its text input active when clicked on
	$inner_cont.on("click", function () { innerContainerToFront($(this)); });

	// Allow changing of tabs within container by tab/shift+tab
	$inner_cont.on("keydown keyup", onKey);

	// Message send handler
	$inner_cont.on("keypress", ".message_input", onMessageInput);
	
	// Define this window as a drop target for other windows and tabs (for merging)
	$(".inner_container").droppable({
		accept: ".inner_container, .ui-tabs-nav li",
		tolerance: "pointer",
		activeClass: "droppable-tab-potential",
		hoverClass: "droppable-tab-hover",
		drop: function(event, ui) {
			if (verbose_debugging)
				console.log("innerContainer .drop");
			// this = droppable cont
			// ui.helper/ui.draggable = draggable cont
			
			if ($(ui.helper).is("li")) {
				// We're dragging a tab, not a whole window
				// The .draggable() 'stop' code, which runs AFTER this function, will use
				// whatever variables we set here
				if ($(this)[0] == $(ui.helper).closest(".inner_container")[0]) {
					// We're dropping the tab on the same window it's from
					dropped_tab_on_self = true;
				}
				else {
					// We're dropping the tab on a different window
					dropped_tab_on_other = this;
				}
			}
			else {
				if (verbose_debugging)
					console.log("calling moveTab() in loop");
				// We're dragging one whole inner_container into another
				// Loop through each tab and move them all to the new container
			
				var $new_inner_cont = $(this); // since 'this' will be different inside .each()
				var active_tab = $(ui.helper).find(".ui-tabs-nav li.ui-tabs-active")[0];
				$(ui.helper).find(".ui-tabs-nav li").each(function() {
					suppress_select = (active_tab != this);
					moveTab($(this),$new_inner_cont);
				});
				$(ui.helper).remove();
			}
			
			// This is to fix a jQuery bug that occurs when you drop over multiple acceptable elements
			$(".droppable-tab-hover").removeClass("droppable-tab-hover");
			// Another bug, but more rare, and may not be jQuery's fault
			$(".droppable-tab-potential").removeClass("droppable-tab-potential");
		}
	});
}

// onInnerContainerChange: any code here needs to be run when tabs are added/removed
function onInnerContainerChange($inner_cont) {
	onTabChange($inner_cont);
}

// onTabChange: any code here needs to be run when tabs are added/removed/selected 
function onTabChange($inner_cont) {
	makeTabResizable($inner_cont);
	// Make draggable all non-active tabs so they can become their own containers 
	$inner_cont.find(".ui-tabs-nav li").each(function() {
		if ($(this).hasClass("ui-tabs-active")) return;

		// IE8 rejects 'distance' option on draggable
		$(this).draggable({
			start: function (event, ui) {
				// Keep tab on top of other tabs while dragging
				innerContainerToFront($(ui.helper));
				$(ui.helper).css("z-index","1000");
				
				// These lookup variables are declared to make the drag() function below as smooth as possible
				dragging_tab_top   = $(ui.helper).offset().top;
				dragging_tab_left  = $(ui.helper).offset().left; // only use for initial start function
				dragging_tab_width = $(ui.helper).prop("offsetWidth")+2; // border size
				dragging_tab_half_width = dragging_tab_width/2;
				$dragging_tab_next = $(ui.helper).next();
				$dragging_tab_prev = $(ui.helper).prev();
			},
			drag: function (event, ui) {
				// If we've drug our chosen tab past either of its neighboring tabs, move the neighbor to make room
				// We add half of any tab's width to its offset().left in order to get the position of its center
				if ($dragging_tab_next.length && $dragging_tab_next.offset().left+($dragging_tab_next.prop("offsetWidth")+2)/2 < ui.offset.left+dragging_tab_half_width) {
					$dragging_tab_next.offset({ top: dragging_tab_top, left: ($dragging_tab_next.offset().left-dragging_tab_width) });
					$dragging_tab_prev = $dragging_tab_next;
					$dragging_tab_next = $dragging_tab_prev.next(); 
				}
				else if ($dragging_tab_prev.length && $dragging_tab_prev.offset().left+($dragging_tab_prev.prop("offsetWidth")+2)/2 > ui.offset.left+dragging_tab_half_width) {
					$dragging_tab_prev.offset({ top: dragging_tab_top, left: ($dragging_tab_prev.offset().left+dragging_tab_width) });
					$dragging_tab_next = $dragging_tab_prev;
					$dragging_tab_prev = $dragging_tab_next.prev(); 
				}
			},
			stop: function(event,ui) {
				if (verbose_debugging)
					console.log("tab drag .stop start");
				var sibs = $(ui.helper).siblings();
				$(sibs).css({left:0, top: 0}); // Reset lingering drag effects
				$(ui.helper).css("z-index","auto");
				
				if (dropped_tab_on_self) { // This variable is determined in .droppable()
					dropped_tab_on_self = false;
					$(ui.helper).css({left:0, top: 0});

					// Place the tab and associated div in its appropriate position
					var our_div_id = $(ui.helper).children("a").attr("href");
					if ($dragging_tab_prev.length && $dragging_tab_prev[0] != $(ui.helper)[0]) {
						var tar_div_id = $dragging_tab_prev.children("a").attr("href");
						$(ui.helper).insertAfter($dragging_tab_prev);
						$(our_div_id).insertAfter(tar_div_id);
					}
					else if ($dragging_tab_next.length && $dragging_tab_next[0] != $(ui.helper)[0]) {
						var tar_div_id = $dragging_tab_next.children("a").attr("href");
						$(ui.helper).insertBefore($dragging_tab_next);
						$(our_div_id).insertBefore(tar_div_id);
					}

					// reset things such as the 'active' marker that get messed up when changing tab order
					var $tab_div = ui.helper.parent().parent();
					$tab_div.tabs("refresh");

					onInnerContainerChange($tab_div.parent());
					return;
				}

				if (dropped_tab_on_other != false) {
					if (verbose_debugging)
						console.log("calling moveTab() from dropped_tab_on_other");
					moveTab($(ui.helper),$(dropped_tab_on_other));
					dropped_tab_on_other = false;
					return;
				}

				// We've dropped an inactive tab somewhere on the page
			
				// Prepare the new inner_container
				$("#outer_container").append(container_html);
				var $old_inner_cont = $(ui.helper).closest(".inner_container");
				var $new_inner_cont = $(".inner_container:last");
				onInnerContainerCreate($new_inner_cont);
				// Make the new container "absolute" so the browser doesn't give us extra white space
				$new_inner_cont.css({ position: "absolute", width: $old_inner_cont.css("width"),
									height: $old_inner_cont.css("height")});
				// Ensure the new container's location is visible
				draggableRepos($new_inner_cont,ui.offset);
				activateLastTabs();
				if (verbose_debugging)
					console.log("calling moveTab() from generic");
				moveTab($(ui.helper),$new_inner_cont);
				// @todo should remove old tab_lookup here and on normal tab close
				
				// Calling this function for the old container makes it re-calculate the
				// width of the tabs (which is now less), allowing to be resized smaller
				makeTabResizable($old_inner_cont);
				if (verbose_debugging)
					console.log("tab drag .stop finish");
			}
		});
	});
}

// This should technically be called "makeWindowResizable", since that's what it does,
// but its behavior needs to be redefined every time the tabs are changed, and I don't
// want to forget that.
function makeTabResizable($inner_cont) {
	// Calculate combined width of tabs to determine minimum horizontal size while resizing
	var tmp_width = 0;
	$inner_cont.find(".ui-tabs-nav li").each(function() {
		tmp_width += parseInt($(this).css("width").match(/\d+/)[0]);
		tmp_width += 20; // for css left+right padding
		tmp_width += 2;  // for css margin-right
		tmp_width += 10;  // fudge
	});
	
	// If the container is already below minimum width, expand!
	var inner_cont_width = $inner_cont.css("width").match(/\d+/)[0]; 
	if (inner_cont_width < tmp_width) {
		var difference = tmp_width - inner_cont_width;
		$inner_cont.css("width",tmp_width+"px");
		$inner_cont.find("div[id^='tabs-']").each(function(){
			var this_tab_id = "#"+$(this).attr("id");
			// Increase appropriate elements' widths by the same amount as $inner_cont
			tab_lookup[this_tab_id].$chat_cont_left.css("width",(parseInt(tab_lookup[this_tab_id].$chat_cont_left.css("width").match(/\d+/)[0])+difference)+"px");
			tab_lookup[this_tab_id].$chat_left.css("width",tab_lookup[this_tab_id].$chat_cont_left.css("width"));
		});
		// Since we expanded, might as well make sure we're not off the screen now
		draggableRepos($inner_cont,null);
	}
	
	// Make the container resizable
	// note: this is in tabs.show() because, for efficiency's sake, we only actively
	// resize elements in the visible tab. so we need to know which tab that is
	$inner_cont.resizable({ 
		minWidth: Math.max(tmp_width,360), // this currently makes chat_left twice the size of chat_right
		minHeight: 100, // arbitrarily set, need something small (25+) just to keep icon from bugging out
		handles: "se", // removing this will add vertical and horizontal resize handles
		// can't use tab_lookup here because tabs() uses a weird order of operations for first tab
		alsoResize: $inner_cont.find(".chat_left:visible"),
		// ui.helper = .inner_container
		start: function(event, ui) {
			// We've begun resizing a window. Store the id of the tab so we can use tab_lookup
			// and be as efficient as possible during the actual resizing
			resizing_tab_id = "#"+$(ui.helper).children().children("div[id^='tabs']:visible").attr("id");
		},
		resize: function (event, ui) {
			// Adjust chat_left's neighboring elements as user is actively resizing
			tab_lookup[resizing_tab_id].$chat_cont_left.css("width",tab_lookup[resizing_tab_id].$chat_left.css("width"));
			tab_lookup[resizing_tab_id].$chat_right.css("height",tab_lookup[resizing_tab_id].$chat_left.css("height"));
		},
		stop: function (event, ui) {
			// User has stopped dragging, now copy current tab's dimensions to non-active tabs
			$(ui.helper).children().children("div[id^='tabs-']").each(function() {
				var this_tab_id = "#"+$(this).attr("id");
				if (this_tab_id == resizing_tab_id) return;
				
				copyTabDimensions(resizing_tab_id,this_tab_id);
			});

			scrollDown(resizing_tab_id);
		}
	});
}

// Called wherever we resize or merge and need to make tab B like tab A
function copyTabDimensions(old_tab_id,new_tab_id) {
	tab_lookup[new_tab_id].$chat_left.css({width: tab_lookup[old_tab_id].$chat_left.css("width"),
		height: tab_lookup[old_tab_id].$chat_left.css("height")});
	tab_lookup[new_tab_id].$chat_cont_left.css("width",tab_lookup[old_tab_id].$chat_cont_left.css("width"));
	tab_lookup[new_tab_id].$chat_right.css("height",tab_lookup[old_tab_id].$chat_right.css("height"));
}

//credit http://www.howtocreate.co.uk/tutorials/javascript/browserwindow
function detectWindowSize() {
	window_width = 800, window_height = 1000;
	if( typeof(window.innerWidth) == 'number' ) {
		//Non-IE
		window_width = window.innerWidth;
		window_height = window.innerHeight;
	} else if(document.documentElement && (document.documentElement.clientWidth || document.documentElement.clientHeight)) {
		//IE 6+ in 'standards compliant mode'
		window_width = document.documentElement.clientWidth;
		window_height = document.documentElement.clientHeight;
	} else if(document.body && ( document.body.clientWidth || document.body.clientHeight)) {
		//IE 4 compatible
		window_width = document.body.clientWidth;
		window_height = document.body.clientHeight;
	}
	window_width = Math.max(window_width,800);
	window_height = Math.max(window_height,800);
}

// Reposition window when it's dragged off-screen
//@todo run this code on .resize() as well?
function draggableRepos($jObj, offset) {
	detectWindowSize();
	if (offset != null) {
		var top = offset.top;
		var left = offset.left;
	}
	else {
		var top = $jObj.offset().top;
		var left = $jObj.offset().left;
	}
	var max_y = window_height - parseInt($jObj.css("height").match(/\d+/)[0]) - 5;
	var max_x = window_width - parseInt($jObj.css("width").match(/\d+/)[0]) - 5;
	$jObj.offset({ top: Math.min(max_y,Math.max(0,parseInt(top))),
				left: Math.min(max_x,Math.max(0,parseInt(left))) });
}

function displayChatMessage(name, msg, tab_id)
{
	var scrolling = false;
	var timestamp = "";
	var $left = tab_lookup[tab_id].$chat_left;
	var active = $left.is(":visible");
	if (active)
		scrolling = $left[0].scrollTop > $left[0].scrollHeight - $left.height() - 10;

	if (tab_lookup[tab_id].chat_history == 500)
		$left.children(".message_row:first").remove();
	else
		tab_lookup[tab_id].chat_history++;

	if (enable_timestamps)
	{
		var now = new Date();
		timestamp = "[" + now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds() + "] ";
	}

	$left.append("<div class='message_row'>" + timestamp
		+ "<span class='username'>" + name + "</span>: " + msg + "</div>");

	if (!active)
		tab_lookup[tab_id].$tab_href.addClass("unread");
	else if (scrolling || name == "You")
		$left.scrollTop($left[0].scrollHeight);
}

function scrollDown(tab_id)
{
	tab_lookup[tab_id].$chat_left.scrollTop(
		tab_lookup[tab_id].$chat_left.prop("scrollHeight"));
}

function lookupTabIDFromMessageInput(selector) {
	for (var key in tab_lookup) {
		if (tab_lookup[key].$message_input[0] == selector[0])
			return key;
	}
	return null;
}

function innerContainerToFront($jObj) {
	$inner_cont = $jObj.closest(".inner_container");
	if ($inner_cont.css("z-index") != current_z_index-1) {
		$inner_cont.css("z-index",current_z_index++); // bring it to the front
	}
	$inner_cont.find(".message_input:visible").focus();	// make the text input active
}

// Maintains a global tab_lookup variable to cut down on repetitive jQuery selections elsewhere
function addToTabLookup(selector) {
	var $tmp = $(selector).find(".chat_container");
	var tab_id = "#"+$tmp.parent().attr("id");
	tab_lookup[tab_id] = {
		$tab_href:			$("a[href='"+tab_id+"']"),
		$chat_container: 	$tmp,
		$chat_cont_left:	$tmp.find(".chat_container_left"),
		$chat_left:			$tmp.find(".chat_left"),
		$chat_bottom_left:	$tmp.find(".chat_bottom_left"),
		$chat_bottom_right:	$tmp.find(".chat_bottom_right"),
		$chat_right:		$tmp.find(".chat_right"),
		$message_input:		$tmp.find(".message_input"),
		chat_history:		0
	};
}

function initGlobals()
{
	enable_timestamps = 1;
	verbose_debugging = 0;
	if (verbose_debugging)
		console.log("Verbose debugging is active");
	current_z_index = 1;
	suppress_select = false;
	dropped_tab_on_self = false;
	dropped_tab_on_other = false;
	shift_pressed = false;
	tab_counter	= 0;
	ws_alive = false;
	container_html = '<div class="inner_container"><div class="ui-tabs">'+
		'<ul id="sortable" class="ui-tabs-nav"></ul></div></div>';
	chat_html = '<div class="chat_container"><div id="chat_top"></div>'+
		'<div class="chat_container_left"><div class="chat_left"></div>'+
		'<div class="chat_bottom_left"><input type="text" name="message" '+
		'class="message_input" /></div></div><div class="chat_container_right">'+
		'<div class="chat_right"></div><div class="chat_bottom_right"><a '+
		'href="javascript:void(0);" id="prefs_link"></a></div></div></div>';
	tab_lookup = {}; // structure: (tab id => ($chat_left => Object, $chat_right => Object))
}

function onMessageInput(e)
{
	if (e.keyCode == 13 && $(this).val().length) //enter
	{
		var msg = $(this).val();
		var tab_id = lookupTabIDFromMessageInput($(this));
		var match;

		displayChatMessage("You", msg, tab_id);
		$(this).val("");
	}
}

// Allow navigating of tabs with tab and shift+tab
function onKey(e)
{
	if (e.keyCode == 16) //shift
	{
		e.preventDefault();
		shift_pressed = (e.type == "keydown");
	}
	if (e.keyCode == 9) //tab
	{
		e.preventDefault();
		if (e.type != "keyup")
			return;

		var $tabs = $(this).children(".ui-tabs");
		var num_tabs = $tabs.children("div").length;
		var inc = 1;
		if (shift_pressed) 
			inc = -1;
		$tabs.tabs("option", "active", ($tabs.tabs("option", "active") + inc) % num_tabs);
	}
}
