/*
	tui.js
---------------------------------------------------------------------
Blessed TUI layout for the Exchange application.
Exports a factory function that creates the screen and wires up
keybindings to the exchange engine.
*/

var blessed = require( 'blessed' );


//---------------------------------------------------------------------
// Theme definitions
//---------------------------------------------------------------------

var THEMES = {
	dark: {
		name: 'dark',
		screen: { bg: 'black' },
		title_bar: { fg: 'white', bg: '#333333', bold: true },
		panel_border: { fg: '#555555' },
		panel: { fg: 'white', bg: 'black' },
		label: { fg: 'cyan', bg: 'black', bold: true },
		selected: { fg: 'black', bg: 'green' },
		status_bar: { fg: 'white', bg: '#333333' },
		log: { fg: 'white', bg: '#111111' },
		secondary: '#888888',
		accent: 'cyan',
		buy: 'green',
		sell: 'red',
		price: 'yellow',
		heading: 'cyan',
	},
	light: {
		name: 'light',
		screen: { bg: 'white' },
		title_bar: { fg: 'black', bg: '#dddddd', bold: true },
		panel_border: { fg: '#999999' },
		panel: { fg: 'black', bg: 'white' },
		label: { fg: '#005f87', bg: 'white', bold: true },
		selected: { fg: 'white', bg: 'blue' },
		status_bar: { fg: 'black', bg: '#dddddd' },
		log: { fg: 'black', bg: '#eeeeee' },
		secondary: '#666666',
		accent: '#005f87',
		buy: 'green',
		sell: 'red',
		price: '#875f00',
		heading: '#005f87',
	},
};


//---------------------------------------------------------------------
// Create the TUI.
// Options:
//   Engine       - ExchangeEngine instance
//---------------------------------------------------------------------

module.exports = function CreateTui( Options )
{
	var current_theme = THEMES.dark;
	var engine = Options.Engine;

	// Panel focus state
	var panels = [];
	var current_panel_index = 0;

	// Selected asset for order book view
	var selected_asset_index = 0;
	var asset_names = [];


	//---------------------------------------------------------------------
	// Screen
	//---------------------------------------------------------------------

	var screen = blessed.screen( {
		smartCSR: true,
		title: 'HiveJS Exchange',
		fullUnicode: true,
	} );


	//---------------------------------------------------------------------
	// Title Bar
	//---------------------------------------------------------------------

	var title_bar = blessed.box( {
		parent: screen,
		top: 0,
		left: 0,
		width: '100%',
		height: 1,
		content: ' HiveJS Exchange',
		tags: true,
		style: {
			fg: 'white',
			bg: '#333333',
			bold: true,
		},
	} );


	//---------------------------------------------------------------------
	// Participants Panel (left, 20%)
	//---------------------------------------------------------------------

	var participant_label = blessed.box( {
		parent: screen,
		top: 1,
		left: 0,
		width: '20%',
		height: 1,
		content: ' PARTICIPANTS',
		tags: true,
		style: { fg: current_theme.label.fg, bg: current_theme.label.bg, bold: true },
	} );

	var participant_list = blessed.list( {
		parent: screen,
		top: 2,
		left: 0,
		width: '20%',
		height: '50%-3',
		border: { type: 'line' },
		tags: true,
		keys: true,
		vi: true,
		mouse: true,
		scrollbar: { ch: ' ', style: { bg: 'gray' } },
		style: {
			fg: 'white',
			bg: 'black',
			border: { fg: '#555555' },
			selected: { fg: 'black', bg: 'green' },
			focus: { border: { fg: 'green' } },
		},
		items: [],
	} );


	//---------------------------------------------------------------------
	// Order Book Panel (middle, 40%)
	//---------------------------------------------------------------------

	var orderbook_label = blessed.box( {
		parent: screen,
		top: 1,
		left: '20%',
		width: '40%',
		height: 1,
		content: ' ORDER BOOK',
		tags: true,
		style: { fg: current_theme.label.fg, bg: current_theme.label.bg, bold: true },
	} );

	var orderbook_panel = blessed.box( {
		parent: screen,
		top: 2,
		left: '20%',
		width: '40%',
		height: '50%-3',
		border: { type: 'line' },
		tags: true,
		keys: true,
		vi: true,
		mouse: true,
		scrollable: true,
		alwaysScroll: true,
		scrollbar: { ch: ' ', style: { bg: 'gray' } },
		label: ' Select an asset ',
		style: {
			fg: 'white',
			bg: 'black',
			border: { fg: '#555555' },
			label: { fg: current_theme.secondary },
			focus: { border: { fg: 'green' } },
		},
		content: '',
	} );


	//---------------------------------------------------------------------
	// Market Summary Panel (right, 40%)
	//---------------------------------------------------------------------

	var market_label = blessed.box( {
		parent: screen,
		top: 1,
		left: '60%',
		width: '40%',
		height: 1,
		content: ' MARKET SUMMARY',
		tags: true,
		style: { fg: current_theme.label.fg, bg: current_theme.label.bg, bold: true },
	} );

	var market_panel = blessed.box( {
		parent: screen,
		top: 2,
		left: '60%',
		width: '40%',
		height: '50%-3',
		border: { type: 'line' },
		tags: true,
		keys: true,
		vi: true,
		mouse: true,
		scrollable: true,
		alwaysScroll: true,
		scrollbar: { ch: ' ', style: { bg: 'gray' } },
		label: ' All Assets ',
		style: {
			fg: 'white',
			bg: 'black',
			border: { fg: '#555555' },
			label: { fg: current_theme.secondary },
			focus: { border: { fg: 'green' } },
		},
		content: '',
	} );


	//---------------------------------------------------------------------
	// Trade Log Panel (bottom, 50%)
	//---------------------------------------------------------------------

	var log_panel = blessed.log( {
		parent: screen,
		top: '50%-1',
		left: 0,
		width: '100%',
		height: '50%-1',
		border: { type: 'line' },
		tags: true,
		keys: true,
		vi: true,
		mouse: true,
		scrollable: true,
		scrollbar: { ch: ' ', style: { bg: 'gray' } },
		label: ' Trade Log ',
		style: {
			fg: current_theme.log.fg,
			bg: current_theme.log.bg,
			border: { fg: current_theme.panel_border.fg },
			label: { fg: current_theme.label.fg },
		},
	} );


	//---------------------------------------------------------------------
	// Status Bar
	//---------------------------------------------------------------------

	var status_bar = blessed.box( {
		parent: screen,
		bottom: 0,
		left: 0,
		width: '100%',
		height: 1,
		tags: true,
		style: {
			fg: 'white',
			bg: '#333333',
		},
		content: '',
	} );

	function update_status_bar()
	{
		var tick_str = 'Tick: ' + engine.TickCount;
		var state_str = engine.IsPaused ? '{red-fg}PAUSED{/red-fg}' : '{green-fg}RUNNING{/green-fg}';
		var speed_str = ( engine.TickIntervalMs / 1000 ).toFixed( 1 ) + 's';

		var parts = [];
		parts.push( `{bold}${tick_str}{/bold}` );
		parts.push( state_str );
		parts.push( `{bold}${speed_str}{/bold}` );
		parts.push( '{bold}q{/bold}:Quit' );
		parts.push( '{bold}p{/bold}:Pause/Resume' );
		parts.push( '{bold}s{/bold}:Step' );
		parts.push( '{bold}+/-{/bold}:Speed' );
			parts.push( '{bold}Tab{/bold}:Pane' );
			parts.push( '{bold}Enter{/bold}:Cycle Asset' );
			parts.push( '{bold}a{/bold}:Add  {bold}e{/bold}:Edit  {bold}d{/bold}:Del' );
			parts.push( '{bold}t{/bold}:Theme' );

		status_bar.setContent( ' ' + parts.join( '  ' ) );
		screen.render();
	}

	update_status_bar();


	//---------------------------------------------------------------------
	// Confirm Dialog
	//---------------------------------------------------------------------

	var confirm_dialog = blessed.question( {
		parent: screen,
		top: 'center',
		left: 'center',
		width: 50,
		height: 7,
		border: { type: 'line' },
		tags: true,
		keys: true,
		vi: false,
		hidden: true,
		label: ' Confirm ',
		style: {
			fg: 'white',
			bg: '#222222',
			border: { fg: 'red' },
			label: { fg: 'red' },
		},
	} );


	//---------------------------------------------------------------------
	// Participant Editor Popup
	//---------------------------------------------------------------------

	// Tracks whether the popup is currently visible
	var popup_visible = false;

	// Cached list of participant data (for looking up selected item)
	var cached_participants = [];

	// Cached list of asset names (for manufacturer asset dropdown)
	var cached_asset_names = [];

	var ROLE_OPTIONS = [ 'supplier', 'consumer', 'speculator', 'hybrid' ];

	// Overlay background
	var popup_overlay = blessed.box( {
		parent: screen,
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
		style: { bg: 'black', fg: 'white' },
		transparent: true,
		hidden: true,
	} );

	// Form container
	var popup_form = blessed.form( {
		parent: popup_overlay,
		top: 'center',
		left: 'center',
		width: 60,
		height: 22,
		border: { type: 'line' },
		label: ' Participant ',
		tags: true,
		keys: true,
		vi: true,
		style: {
			bg: '#1a1a2e',
			border: { fg: 'cyan' },
			label: { fg: 'cyan' },
		},
	} );

	// --- Focusable form fields ---
	// Each input widget has focus styling so the user can see where they are.

	var FOCUS_BG = '#444477';
	var NORMAL_BG = '#333355';
	var DIM_FG = '#666666';

	// Field: AccountName
	var field_account_label = blessed.text( {
		parent: popup_form,
		top: 1,
		left: 2,
		content: 'Name:',
		style: { fg: 'white', bold: true },
	} );
	var field_account = blessed.textbox( {
		parent: popup_form,
		top: 1,
		left: 14,
		width: 40,
		height: 1,
		inputOnFocus: true,
		style: { fg: 'white', bg: NORMAL_BG },
		focus: { bg: FOCUS_BG },
	} );

	// Field: Role (blessed.list — arrow keys or Enter/Space to cycle)
	var field_role_label = blessed.text( {
		parent: popup_form,
		top: 3,
		left: 2,
		content: 'Role:',
		style: { fg: 'white', bold: true },
	} );
	var field_role = blessed.list( {
		parent: popup_form,
		top: 3,
		left: 14,
		width: 20,
		height: 1,
		items: ROLE_OPTIONS,
		keys: true,
		mouse: true,
		style: {
			fg: 'yellow',
			bg: NORMAL_BG,
			selected: { fg: 'yellow', bg: FOCUS_BG, bold: true },
			focus: { bg: FOCUS_BG },
		},
	} );
	field_role.select( 2 ); // default: speculator

	// Field: ConversationName
	var field_conversation_label = blessed.text( {
		parent: popup_form,
		top: 5,
		left: 2,
		content: 'Conversation:',
		style: { fg: 'white', bold: true },
	} );
	var field_conversation = blessed.textbox( {
		parent: popup_form,
		top: 5,
		left: 18,
		width: 36,
		height: 1,
		inputOnFocus: true,
		style: { fg: 'white', bg: NORMAL_BG },
		focus: { bg: FOCUS_BG },
	} );

	// Field: Starting EC
	var field_ec_label = blessed.text( {
		parent: popup_form,
		top: 7,
		left: 2,
		content: 'Starting EC:',
		style: { fg: 'white', bold: true },
	} );
	var field_ec = blessed.textbox( {
		parent: popup_form,
		top: 7,
		left: 18,
		width: 20,
		height: 1,
		inputOnFocus: true,
		style: { fg: 'white', bg: NORMAL_BG },
		focus: { bg: FOCUS_BG },
	} );

	// Field: IsManufacturer (blessed.checkbox)
	var field_mfg_label = blessed.text( {
		parent: popup_form,
		top: 9,
		left: 2,
		content: 'Manufacturer:',
		style: { fg: 'white', bold: true },
	} );
	var field_mfg = blessed.checkbox( {
		parent: popup_form,
		top: 9,
		left: 18,
		width: 14,
		height: 1,
		content: '',
		checked: false,
		keys: true,
		mouse: true,
		style: {
			fg: 'red',
			bg: NORMAL_BG,
			bold: true,
			focus: { bg: FOCUS_BG },
		},
	} );

	// Field: ManufactureAsset (blessed.list — cycle with arrow keys or Enter/Space)
	var field_mfg_asset_label = blessed.text( {
		parent: popup_form,
		top: 11,
		left: 2,
		content: 'Mfg Asset:',
		style: { fg: DIM_FG },
	} );
	var field_mfg_asset = blessed.list( {
		parent: popup_form,
		top: 11,
		left: 18,
		width: 20,
		height: 1,
		items: [ '-' ],
		keys: true,
		mouse: true,
		style: {
			fg: DIM_FG,
			bg: NORMAL_BG,
			selected: { fg: DIM_FG, bg: NORMAL_BG },
			focus: { bg: FOCUS_BG },
		},
	} );
	field_mfg_asset.select( 0 );

	// Field: ManufactureRate
	var field_mfg_rate_label = blessed.text( {
		parent: popup_form,
		top: 13,
		left: 2,
		content: 'Mfg Rate:',
		style: { fg: DIM_FG },
	} );
	var field_mfg_rate = blessed.textbox( {
		parent: popup_form,
		top: 13,
		left: 18,
		width: 20,
		height: 1,
		inputOnFocus: true,
		style: { fg: 'white', bg: NORMAL_BG },
		focus: { bg: FOCUS_BG },
	} );

	// Field: InitialHoldings (text: "asset:qty, asset:qty")
	var field_holdings_label = blessed.text( {
		parent: popup_form,
		top: 15,
		left: 2,
		content: 'Holdings:',
		style: { fg: 'white', bold: true },
	} );
	var field_holdings = blessed.textbox( {
		parent: popup_form,
		top: 15,
		left: 18,
		width: 36,
		height: 1,
		inputOnFocus: true,
		style: { fg: 'white', bg: NORMAL_BG },
		focus: { bg: FOCUS_BG },
	} );

	// Help line
	var popup_help = blessed.text( {
		parent: popup_form,
		top: 17,
		left: 2,
		content: 'Tab: next field  Enter/Spc: toggle  Esc: cancel  F10: save',
		style: { fg: '#888888' },
	} );

	// Buttons row
	var btn_save = blessed.button( {
		parent: popup_form,
		top: 19,
		left: 14,
		width: 10,
		height: 1,
		content: '[ Save ]',
		style: { fg: 'green', bold: true, bg: '#222244', focus: { bg: '#336633' } },
		shrink: true,
	} );

	var btn_cancel = blessed.button( {
		parent: popup_form,
		top: 19,
		left: 28,
		width: 12,
		height: 1,
		content: '[ Cancel ]',
		style: { fg: 'red', bold: true, bg: '#222244', focus: { bg: '#663333' } },
		shrink: true,
	} );

	// All focusable popup elements in tab order
	var popup_fields = [
		field_account, field_role, field_conversation,
		field_ec, field_mfg, field_mfg_asset, field_mfg_rate,
		field_holdings, btn_save, btn_cancel,
	];
	var popup_field_index = 0;


	//---------------------------------------------------------------------
	// Show the participant popup (create or edit mode)
	//---------------------------------------------------------------------

	var popup_mode = 'create'; // 'create' or 'edit'
	var popup_edit_account = ''; // account name being edited

	function show_participant_popup( Mode, ParticipantData )
	{
		popup_mode = Mode;
		popup_visible = true;

		// Update mfg asset list with cached asset names
		var asset_items = cached_asset_names.length > 0
			? cached_asset_names.slice()
			: [ '-' ];
		field_mfg_asset.setItems( asset_items );
		field_mfg_asset.select( 0 );

		// Reset fields
		if ( Mode === 'create' )
		{
			popup_form.setLabel( ' Add Participant ' );
			field_account.setValue( '' );
			field_role.select( 2 ); // speculator
			field_conversation.setValue( '' );
			field_ec.setValue( '' );
			field_mfg.uncheck();
			field_mfg_asset.select( 0 );
			field_mfg_rate.setValue( '' );
			field_holdings.setValue( '' );
		}
		else
		{
			popup_form.setLabel( ' Edit Participant ' );
			popup_edit_account = ParticipantData.AccountName;
			field_account.setValue( ParticipantData.AccountName || '' );
			var role_idx = ROLE_OPTIONS.indexOf( ParticipantData.Role );
			field_role.select( ( role_idx >= 0 ) ? role_idx : 2 );
			field_conversation.setValue( ParticipantData.ConversationName || '' );
			field_ec.setValue( '' ); // EC not editable in edit mode
			if ( ParticipantData.IsManufacturer ) { field_mfg.check(); }
			else { field_mfg.uncheck(); }
			field_mfg_rate.setValue( ParticipantData.ManufactureRate ? String( ParticipantData.ManufactureRate ) : '' );
			field_holdings.setValue( '' ); // Holdings not editable in edit mode

			// Set manufacture asset index
			field_mfg_asset.select( 0 );
			if ( ParticipantData.ManufactureAsset && cached_asset_names.length > 0 )
			{
				var mfg_idx = cached_asset_names.indexOf( ParticipantData.ManufactureAsset );
				if ( mfg_idx >= 0 ) { field_mfg_asset.select( mfg_idx ); }
			}
		}

		update_popup_display();
		popup_overlay.show();
		popup_field_index = 0;
		popup_fields[ 0 ].focus();
		screen.render();
	}


	//---------------------------------------------------------------------
	// Hide the participant popup
	//---------------------------------------------------------------------

	function hide_participant_popup()
	{
		popup_visible = false;
		popup_overlay.hide();
		focus_panel( current_panel_index );
		screen.render();
	}


	//---------------------------------------------------------------------
	// Update the popup display to reflect current field values
	//---------------------------------------------------------------------

	function update_popup_display()
	{
		// Update role list colors based on selected role
		var role_selected = field_role.selected;
		var role_name = ROLE_OPTIONS[ role_selected ] || 'speculator';
		var role_color = role_name === 'supplier' ? 'green'
			: role_name === 'consumer' ? 'yellow'
			: role_name === 'speculator' ? 'magenta'
			: 'cyan';
		field_role.style.selected.fg = role_color;
		field_role.style.fg = role_color;

		// Update manufacturer checkbox display
		var is_mfg = field_mfg.checked;
		field_mfg.style.fg = is_mfg ? 'green' : 'red';

		// Update mfg asset list colors
		field_mfg_asset.style.fg = is_mfg ? 'white' : DIM_FG;
		field_mfg_asset.style.selected.fg = is_mfg ? 'white' : DIM_FG;

		// Dim the manufacturer fields when not a manufacturer
		field_mfg_asset_label.style.fg = is_mfg ? 'white' : DIM_FG;
		field_mfg_rate_label.style.fg = is_mfg ? 'white' : DIM_FG;

		screen.render();
	}


	//---------------------------------------------------------------------
	// Cycle focus through popup fields
	//---------------------------------------------------------------------

	function cycle_popup_focus( Direction )
	{
		popup_field_index += Direction;
		if ( popup_field_index < 0 ) { popup_field_index = popup_fields.length - 1; }
		if ( popup_field_index >= popup_fields.length ) { popup_field_index = 0; }
		popup_fields[ popup_field_index ].focus();
		screen.render();
	}


	//---------------------------------------------------------------------
	// Save the participant from the popup form
	//---------------------------------------------------------------------

	async function save_participant()
	{
		var account_name = field_account.getValue().trim();
		var role_idx = field_role.selected;
		var role = ROLE_OPTIONS[ role_idx ] || 'speculator';
		var conversation_name = field_conversation.getValue().trim();
		var starting_ec = parseFloat( field_ec.getValue().trim() ) || undefined;
		var is_manufacturer = field_mfg.checked;
		var mfg_asset_idx = field_mfg_asset.selected;
		var manufacture_asset = ( is_manufacturer && cached_asset_names.length > 0 )
			? ( cached_asset_names[ mfg_asset_idx ] || '' ) : '';
		var manufacture_rate = is_manufacturer ? ( parseFloat( field_mfg_rate.getValue().trim() ) || 0 ) : 0;
		var holdings_text = field_holdings.getValue().trim();

		// Parse holdings: "iron:100, grain:50"
		var initial_holdings = {};
		if ( holdings_text )
		{
			var pairs = holdings_text.split( ',' );
			for ( var i = 0; i < pairs.length; i++ )
			{
				var pair = pairs[ i ].trim();
				if ( !pair ) { continue; }
				var colon_idx = pair.indexOf( ':' );
				if ( colon_idx < 0 ) { continue; }
				var asset = pair.substring( 0, colon_idx ).trim();
				var qty = parseFloat( pair.substring( colon_idx + 1 ).trim() );
				if ( asset && qty > 0 )
				{
					initial_holdings[ asset ] = qty;
				}
			}
		}

		if ( !account_name )
		{
			log_message( '{red-fg}Participant name is required.{/red-fg}' );
			hide_participant_popup();
			return;
		}

		hide_participant_popup();

		if ( popup_mode === 'create' )
		{
			var result = await engine.Hive.InvokeTool( 'Exchange.CreateParticipant', {
				EntityName: engine.ExchangeName,
				AccountName: account_name,
				Role: role,
				ConversationName: conversation_name || undefined,
				IsManufacturer: is_manufacturer,
				ManufactureAsset: manufacture_asset || undefined,
				ManufactureRate: manufacture_rate || undefined,
				StartingEc: starting_ec,
				InitialHoldings: Object.keys( initial_holdings ).length > 0 ? initial_holdings : undefined,
			} );

			if ( result.Success && result.Result && !result.Result.Error )
			{
				log_message( '{green-fg}Created participant: ' + account_name + '{/green-fg}' );
			}
			else
			{
				log_message( '{red-fg}Error: ' + ( result.Result && result.Result.Error ? result.Result.Error : result.Error ) + '{/red-fg}' );
			}
		}
		else
		{
			var update_args = {
				EntityName: engine.ExchangeName,
				AccountName: popup_edit_account,
				Role: role,
			};
			if ( conversation_name ) { update_args.ConversationName = conversation_name; }
			update_args.IsManufacturer = is_manufacturer;
			if ( manufacture_asset ) { update_args.ManufactureAsset = manufacture_asset; }
			if ( manufacture_rate > 0 ) { update_args.ManufactureRate = manufacture_rate; }

			var result = await engine.Hive.InvokeTool( 'Exchange.UpdateParticipant', update_args );

			if ( result.Success && result.Result && !result.Result.Error )
			{
				log_message( '{green-fg}Updated participant: ' + popup_edit_account + '{/green-fg}' );
			}
			else
			{
				log_message( '{red-fg}Error: ' + ( result.Result && result.Result.Error ? result.Result.Error : result.Error ) + '{/red-fg}' );
			}
		}

		await refresh_all();
	}


	//---------------------------------------------------------------------
	// Delete the selected participant
	//---------------------------------------------------------------------

	async function delete_selected_participant()
	{
		var selected = participant_list.selected;
		if ( selected < 0 || selected >= cached_participants.length ) { return; }

		var participant = cached_participants[ selected ];
		var name = participant.AccountName;

		confirm_dialog.ask( 'Remove participant "' + name + '"? (y/n)', function ( err, confirmed )
		{
			if ( confirmed )
			{
				engine.Hive.InvokeTool( 'Exchange.RemoveParticipant', {
					EntityName: engine.ExchangeName,
					AccountName: name,
				} ).then( function ( result )
				{
					if ( result.Success && result.Result && !result.Result.Error )
					{
						log_message( '{yellow-fg}Removed participant: ' + name + '{/yellow-fg}' );
					}
					else
					{
						log_message( '{red-fg}Error: ' + ( result.Result && result.Result.Error ? result.Result.Error : result.Error ) + '{/red-fg}' );
					}
					refresh_all();
				} );
			}
			focus_panel( current_panel_index );
		} );
	}


	//---------------------------------------------------------------------
	// Popup key handling
	//---------------------------------------------------------------------

	// Role field: Enter/Space cycles to next role
	field_role.key( [ 'enter', 'space' ], function ()
	{
		var idx = field_role.selected;
		idx = ( idx + 1 ) % ROLE_OPTIONS.length;
		field_role.select( idx );
		update_popup_display();
	} );

	// Mfg asset field: Enter/Space cycles to next asset
	field_mfg_asset.key( [ 'enter', 'space' ], function ()
	{
		if ( cached_asset_names.length > 0 )
		{
			var idx = field_mfg_asset.selected;
			idx = ( idx + 1 ) % cached_asset_names.length;
			field_mfg_asset.select( idx );
			update_popup_display();
		}
	} );

	// Manufacturer checkbox: update display when toggled
	field_mfg.on( 'check', function () { update_popup_display(); } );
	field_mfg.on( 'uncheck', function () { update_popup_display(); } );

	// Save button
	btn_save.key( [ 'enter', 'space' ], function ()
	{
		save_participant();
	} );
	btn_save.on( 'press', function ()
	{
		save_participant();
	} );

	// Cancel button
	btn_cancel.key( [ 'enter', 'space' ], function ()
	{
		hide_participant_popup();
	} );
	btn_cancel.on( 'press', function ()
	{
		hide_participant_popup();
	} );

	// F10 = Save in popup
	screen.key( [ 'f10' ], function ()
	{
		if ( popup_visible )
		{
			save_participant();
		}
	} );
		// Tab — next popup field (when popup open) or next panel
	screen.key( [ 'tab' ], function ()
	{
		if ( popup_visible )
		{
			cycle_popup_focus( 1 );
			return;
		}
		focus_panel( current_panel_index + 1 );
	} );

	// Shift-Tab — prev popup field (when popup open) or prev panel
	screen.key( [ 'S-tab' ], function ()
	{
		if ( popup_visible )
		{
			cycle_popup_focus( -1 );
			return;
		}
		focus_panel( current_panel_index - 1 );
	} );


//---------------------------------------------------------------------
	// Panel focus management
	//---------------------------------------------------------------------

	panels = [ participant_list, orderbook_panel, market_panel ];
	var panel_labels = [ participant_label, orderbook_label, market_label ];

	function focus_panel( Index )
	{
		if ( Index < 0 ) { Index = panels.length - 1; }
		if ( Index >= panels.length ) { Index = 0; }
		current_panel_index = Index;
		panels[ current_panel_index ].focus();
		screen.render();
	}


	//---------------------------------------------------------------------
	// Log a message to the trade log
	//---------------------------------------------------------------------

	function log_message( Text )
	{
		var now = new Date();
		var time_str = pad_left( now.getHours(), 2 )
			+ ':' + pad_left( now.getMinutes(), 2 )
			+ ':' + pad_left( now.getSeconds(), 2 );
		var sc = current_theme.secondary;
		log_panel.log( '{' + sc + '-fg}' + time_str + '{/' + sc + '-fg} ' + Text );
		screen.render();
	}


	//---------------------------------------------------------------------
	// Render participants list
	//---------------------------------------------------------------------

	async function render_participants()
	{
		try
		{
			var result = await engine.Hive.InvokeTool( 'Exchange.ListParticipants', {
				EntityName: engine.ExchangeName,
			} );

			if ( !result.Success || !result.Result ) { return; }

			cached_participants = result.Result;

			var items = [];
			for ( var index = 0; index < result.Result.length; index++ )
			{
				var participant = result.Result[ index ];
				var sc = current_theme.secondary;
				var role_color = participant.Role === 'supplier' ? 'green'
					: participant.Role === 'consumer' ? 'yellow'
					: participant.Role === 'speculator' ? 'magenta'
					: 'cyan';
				var active_marker = participant.IsActive ? '' : '{red-fg}[OFF]{/red-fg} ';
				items.push( ' ' + active_marker
					+ '{' + role_color + '-fg}' + participant.Role + '{/' + role_color + '-fg} '
					+ participant.AccountName
					+ ' {' + sc + '-fg}' + ( participant.EcBalance || 0 ).toFixed( 0 ) + ' EC{/' + sc + '-fg}' );
			}

			participant_list.setItems( items );
			screen.render();
		}
		catch ( error )
		{
			// Silently ignore render errors
		}
	}


	//---------------------------------------------------------------------
	// Render order book for selected asset
	//---------------------------------------------------------------------

	async function render_orderbook()
	{
		try
		{
			// Get asset names
			var assets_result = await engine.Hive.InvokeTool( 'Exchange.ListAssets', {
				EntityName: engine.ExchangeName,
			} );

			if ( !assets_result.Success || !assets_result.Result ) { return; }

			asset_names = assets_result.Result.map( function ( a ) { return a.AssetName; } );

			if ( asset_names.length === 0 )
			{
				orderbook_panel.setContent( '{#888888-fg}No assets registered yet.{/#888888-fg}' );
				screen.render();
				return;
			}

			// Clamp selected index
			if ( selected_asset_index >= asset_names.length ) { selected_asset_index = 0; }
			if ( selected_asset_index < 0 ) { selected_asset_index = asset_names.length - 1; }

			var asset_name = asset_names[ selected_asset_index ];

			// Get order book
			var book_result = await engine.Hive.InvokeTool( 'Exchange.GetOrderBook', {
				EntityName: engine.ExchangeName,
				AssetName: asset_name,
			} );

			var lines = [];
			var hc = current_theme.heading;
			var sc = current_theme.secondary;
			var bc = current_theme.buy;
			var ac = current_theme.sell;
			var pc = current_theme.price;

			// Asset header
			lines.push( '{' + hc + '-fg}{bold}' + asset_name.toUpperCase() + '{/bold}{/' + hc + '-fg}' );
			lines.push( '' );

			if ( !book_result.Success || !book_result.Result )
			{
				lines.push( '{' + sc + '-fg}Error loading order book{/' + sc + '-fg}' );
			}
			else
			{
				var book = book_result.Result;

				// Asks (sellers) — displayed top-down from highest ask to lowest
				lines.push( '{' + ac + '-fg}{bold}ASKS (sellers){/bold}{/' + ac + '-fg}' );
				if ( book.Asks && book.Asks.length > 0 )
				{
					var asks_reversed = book.Asks.slice().reverse();
					for ( var a = 0; a < asks_reversed.length; a++ )
					{
						var ask = asks_reversed[ a ];
						lines.push( '  {' + pc + '-fg}' + ask.Price.toFixed( 2 ) + '{/' + pc + '-fg}  '
							+ ask.Quantity.toFixed( 0 ) + ' units'
							+ ' {' + sc + '-fg}(' + ask.OrderCount + ' orders){/' + sc + '-fg}' );
					}
				}
				else
				{
					lines.push( '  {' + sc + '-fg}(no asks){/' + sc + '-fg}' );
				}

				lines.push( '' );
				lines.push( '{' + hc + '-fg}--- Spread ---{' + hc + '-fg}' );
				lines.push( '' );

				// Bids (buyers) — displayed top-down from highest bid to lowest
				lines.push( '{' + bc + '-fg}{bold}BIDS (buyers){/bold}{/' + bc + '-fg}' );
				if ( book.Bids && book.Bids.length > 0 )
				{
					for ( var b = 0; b < book.Bids.length; b++ )
					{
						var bid = book.Bids[ b ];
						lines.push( '  {' + pc + '-fg}' + bid.Price.toFixed( 2 ) + '{/' + pc + '-fg}  '
							+ bid.Quantity.toFixed( 0 ) + ' units'
							+ ' {' + sc + '-fg}(' + bid.OrderCount + ' orders){/' + sc + '-fg}' );
					}
				}
				else
				{
					lines.push( '  {' + sc + '-fg}(no bids){/' + sc + '-fg}' );
				}
			}

			var nav_hint = ( asset_names.length > 1 )
				? '  {' + sc + '-fg}Enter: cycle assets{/' + sc + '-fg}'
				: '';

			orderbook_panel.setLabel( ' ' + asset_name + nav_hint + ' ' );
			orderbook_panel.setContent( lines.join( '\n' ) );
			screen.render();
		}
		catch ( error )
		{
			// Silently ignore render errors
		}
	}


	//---------------------------------------------------------------------
	// Render market summary
	//---------------------------------------------------------------------

	async function render_market_summary()
	{
		try
		{
			var result = await engine.Hive.InvokeTool( 'Exchange.GetMarketSummary', {
				EntityName: engine.ExchangeName,
			} );

			if ( !result.Success || !result.Result ) { return; }

			var lines = [];
			var hc = current_theme.heading;
			var sc = current_theme.secondary;
			var pc = current_theme.price;

			var assets = result.Result.Assets || [];

			for ( var index = 0; index < assets.length; index++ )
			{
				var asset = assets[ index ];
				var price_str = ( asset.LastPrice !== null ) ? '{' + pc + '-fg}' + asset.LastPrice.toFixed( 2 ) + '{/' + pc + '-fg}' : '{' + sc + '-fg}--{/' + sc + '-fg}';
				var bid_str = ( asset.BestBid !== null ) ? asset.BestBid.toFixed( 2 ) : '--';
				var ask_str = ( asset.BestAsk !== null ) ? asset.BestAsk.toFixed( 2 ) : '--';
				var spread_str = ( asset.Spread !== null ) ? asset.Spread.toFixed( 2 ) : '--';

				lines.push( '{' + hc + '-fg}{bold}' + asset.DisplayName + '{/bold}{/' + hc + '-fg}' );
				lines.push( '  Price: ' + price_str + '  Bid: ' + bid_str + '  Ask: ' + ask_str );
				lines.push( '  Spread: ' + spread_str + '  Vol: ' + asset.TotalVolume );
				lines.push( '  Supply: ' + asset.CirculatingSupply + '/' + asset.TotalSupply );
				lines.push( '' );
			}

			if ( assets.length === 0 )
			{
				lines.push( '{' + sc + '-fg}No assets registered.{/' + sc + '-fg}' );
			}

			market_panel.setContent( lines.join( '\n' ) );
			screen.render();
		}
		catch ( error )
		{
			// Silently ignore render errors
		}
	}


	//---------------------------------------------------------------------
	// Full refresh of all panels
	//---------------------------------------------------------------------

	async function refresh_all()
	{
		await render_participants();
		await render_orderbook();
		await render_market_summary();
		update_status_bar();
	}


	//---------------------------------------------------------------------
	// Engine event callbacks
	//---------------------------------------------------------------------

	function on_tick_start( TickCount )
	{
		update_status_bar();
	}

	async function on_tick_complete( TickCount, Result, DurationMs )
	{
		await refresh_all();
	}

	function on_engine_state_changed()
	{
		update_status_bar();
	}


	//---------------------------------------------------------------------
	// Key bindings
	//---------------------------------------------------------------------

	// Quit
	screen.key( [ 'q', 'C-c' ], function ()
	{
		engine.Stop();
		screen.destroy();
		process.exit( 0 );
	} );

	// p — pause/resume
	screen.key( [ 'p' ], function ()
	{
		if ( popup_visible ) { return; }
		engine.TogglePause();
	} );

	// s — step (while paused)
	screen.key( [ 's' ], function ()
	{
		if ( popup_visible ) { return; }
		if ( engine.IsPaused )
		{
			log_message( '{yellow-fg}Manual step...{/yellow-fg}' );
			engine.Step();
		}
	} );

	// + — increase speed (decrease interval)
	screen.key( [ '+', '=' ], function ()
	{
		if ( popup_visible ) { return; }
		engine.SetTickInterval( engine.TickIntervalMs - 2000 );
		log_message( '{cyan-fg}Speed: ' + ( engine.TickIntervalMs / 1000 ).toFixed( 1 ) + 's{/cyan-fg}' );
	} );

	// - — decrease speed (increase interval)
	screen.key( [ '-' ], function ()
	{
		if ( popup_visible ) { return; }
		engine.SetTickInterval( engine.TickIntervalMs + 2000 );
		log_message( '{cyan-fg}Speed: ' + ( engine.TickIntervalMs / 1000 ).toFixed( 1 ) + 's{/cyan-fg}' );
	} );

	// t — toggle theme
	screen.key( [ 't' ], function ()
	{
		if ( popup_visible ) { return; }
		if ( current_theme.name === 'dark' )
		{
			current_theme = THEMES.light;
		}
		else
		{
			current_theme = THEMES.dark;
		}
		apply_theme();
		screen.render();
	} );

	// Enter — cycle assets in order book
	screen.key( [ 'enter' ], function ()
	{
		if ( popup_visible ) { return; }
		if ( current_panel_index === 1 )
		{
			selected_asset_index++;
			if ( selected_asset_index >= asset_names.length ) { selected_asset_index = 0; }
			render_orderbook();
		}
	} );

	// Escape - close popup if open, otherwise quit
	screen.key( [ 'escape' ], function ()
	{
		if ( popup_visible )
		{
			hide_participant_popup();
			return;
		}
		engine.Stop();
		screen.destroy();
		process.exit( 0 );
	} );

	// a - add participant
	screen.key( [ 'a' ], function ()
	{
		if ( popup_visible ) { return; }
		// Refresh cached asset names for the popup
		engine.Hive.InvokeTool( 'Exchange.ListAssets', {
			EntityName: engine.ExchangeName,
		} ).then( function ( result )
		{
			if ( result.Success && result.Result )
			{
				cached_asset_names = result.Result.map( function ( a ) { return a.AssetName; } );
			}
			show_participant_popup( 'create', null );
		} );
	} );

	// e - edit selected participant
	screen.key( [ 'e' ], function ()
	{
		if ( popup_visible ) { return; }
		var selected = participant_list.selected;
		if ( selected < 0 || selected >= cached_participants.length ) { return; }
		// Refresh cached asset names for the popup
		engine.Hive.InvokeTool( 'Exchange.ListAssets', {
			EntityName: engine.ExchangeName,
		} ).then( function ( result )
		{
			if ( result.Success && result.Result )
			{
				cached_asset_names = result.Result.map( function ( a ) { return a.AssetName; } );
			}
			show_participant_popup( 'edit', cached_participants[ selected ] );
		} );
	} );

	// d - delete selected participant
	screen.key( [ 'd' ], function ()
	{
		if ( popup_visible ) { return; }
		delete_selected_participant();
	} );


	//---------------------------------------------------------------------
	// Apply theme to all widgets
	//---------------------------------------------------------------------

	function apply_theme()
	{
		title_bar.style.bg = current_theme.title_bar.bg;
		title_bar.style.fg = current_theme.title_bar.fg;

		participant_label.style.fg = current_theme.label.fg;
		participant_label.style.bg = current_theme.label.bg;
		orderbook_label.style.fg = current_theme.label.fg;
		orderbook_label.style.bg = current_theme.label.bg;
		market_label.style.fg = current_theme.label.fg;
		market_label.style.bg = current_theme.label.bg;

		participant_list.style.fg = current_theme.panel.fg;
		participant_list.style.bg = current_theme.panel.bg;
		participant_list.style.border.fg = current_theme.panel_border.fg;
		participant_list.style.selected = current_theme.selected;

		orderbook_panel.style.fg = current_theme.panel.fg;
		orderbook_panel.style.bg = current_theme.panel.bg;
		orderbook_panel.style.border.fg = current_theme.panel_border.fg;

		market_panel.style.fg = current_theme.panel.fg;
		market_panel.style.bg = current_theme.panel.bg;
		market_panel.style.border.fg = current_theme.panel_border.fg;

		log_panel.style.fg = current_theme.log.fg;
		log_panel.style.bg = current_theme.log.bg;
		log_panel.style.border.fg = current_theme.panel_border.fg;

		status_bar.style.fg = current_theme.status_bar.fg;
		status_bar.style.bg = current_theme.status_bar.bg;
	}


	//---------------------------------------------------------------------
	// Initialize
	//---------------------------------------------------------------------

	// Initial render
	refresh_all();

	// Set up periodic refresh (every 5 seconds when not ticking)
	setInterval( function ()
	{
		refresh_all();
	}, 5000 );

	// Initial focus
	participant_list.focus();
	screen.render();


	//---------------------------------------------------------------------
	// Return public interface
	//---------------------------------------------------------------------

	return {
		Screen: screen,
		Log: log_message,
		OnTickStart: on_tick_start,
		OnTickComplete: on_tick_complete,
		OnEngineStateChanged: on_engine_state_changed,
		RefreshAll: refresh_all,
		Destroy: function () { screen.destroy(); },
	};
};


//---------------------------------------------------------------------
function pad_left( Value, Width )
{
	var str = String( Value );
	while ( str.length < Width ) { str = '0' + str; }
	return str;
}