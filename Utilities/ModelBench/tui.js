/*
	tui.js
---------------------------------------------------------------------
Blessed TUI layout and widget definitions for ModelBench.
Exports a factory function that creates the screen and wires up
keybindings to provided callbacks.
*/

var blessed = require( 'blessed' );


//---------------------------------------------------------------------
// Theme definitions
//---------------------------------------------------------------------

var THEMES = {
	dark: {
		name: 'dark',
		screen: { bg: 'black' },
		title_bar: { fg: 'bold', bg: '#333333' },
		panel_border: { fg: '#555555' },
		panel: { fg: 'white', bg: 'black' },
		label: { fg: 'cyan', bg: 'black' },
		selected: { fg: 'black', bg: 'green' },
		status_bar: { fg: 'white', bg: '#333333' },
		log: { fg: 'white', bg: '#111111' },
		detail: { fg: 'white', bg: '#0a0a0a' },
		pass: '{green-fg}PASS{/green-fg}',
		fail: '{red-fg}FAIL{/red-fg}',
		pending: '{#666666-fg} -- {/#666666-fg}',
		run: '{yellow-fg} .. {/yellow-fg}',
		secondary: '#888888',
		accent: 'cyan',
		cursor: 'white',
		heading: 'cyan',
		tool_heading: 'magenta',
		prompt_heading: 'yellow',
		args: '#888888',
	},
	light: {
		name: 'light',
		screen: { bg: 'white' },
		title_bar: { fg: 'bold', bg: '#dddddd' },
		panel_border: { fg: '#999999' },
		panel: { fg: 'black', bg: 'white' },
		label: { fg: '#005f87', bg: 'white' },
		selected: { fg: 'white', bg: 'blue' },
		status_bar: { fg: 'black', bg: '#dddddd' },
		log: { fg: 'black', bg: '#eeeeee' },
		detail: { fg: 'black', bg: '#f5f5f5' },
		pass: '{green-fg}PASS{/green-fg}',
		fail: '{red-fg}FAIL{/red-fg}',
		pending: '{#999999-fg} -- {/#999999-fg}',
		run: '{#b8860b-fg} .. {/#b8860b-fg}',
		secondary: '#666666',
		accent: '#005f87',
		cursor: 'black',
		heading: '#005f87',
		tool_heading: '#870087',
		prompt_heading: '#875f00',
		args: '#666666',
	},
};


//---------------------------------------------------------------------
// Create the TUI.
// Options:
//   Models       - array of model objects from models.json
//   TestGroups   - array of { Name, Tests: [{ Name }] }
//   OnRunTest    - function( model_index, group_name, test_name )
//   OnRunGroup   - function( model_index, group_name )
//   OnRunAll     - function( model_index )
//   OnCompare    - function()
//   OnResults    - function( model_index )
//   OnCancel     - function()
//   OnClear      - function()
//---------------------------------------------------------------------

module.exports = function CreateTui( Options )
{
	var current_theme = THEMES.dark;
	var test_statuses = {};
	var test_interchanges = {};
	var log_visible = true;
	var panels = [];
	var current_panel_index = 0;

	// Group collapse state: { group_name: bool }
	var group_collapse_states = {};

	// Visible items in test list (rebuilt on group toggle)
	// Each: { type: 'group'|'test', group_name, test_name, full_name }
	var visible_items = [];

	// Collapsible section state per test name.
	// Key: TestName, Value: { sections: [ { collapsed } ] }
	var detail_sections = {};


	//---------------------------------------------------------------------
	// Layout height helpers
	//---------------------------------------------------------------------

	var PANEL_TOP = '70%-3';
	var PANEL_TOP_FULL = '100%-3';
	var LOG_HEIGHT = '30%-1';


	//---------------------------------------------------------------------
	// Screen
	//---------------------------------------------------------------------

	var screen = blessed.screen( {
		smartCSR: true,
		title: 'ModelBench',
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
		content: ' ModelBench',
		tags: true,
		style: {
			fg: 'white',
			bg: '#333333',
			bold: true,
		},
	} );


	//---------------------------------------------------------------------
	// Model List (left panel, 20%)
	//---------------------------------------------------------------------

	var model_label = blessed.box( {
		parent: screen,
		top: 1,
		left: 0,
		width: '20%',
		height: 1,
		content: ' MODELS',
		tags: true,
		style: { fg: current_theme.label.fg, bg: current_theme.label.bg, bold: true },
	} );

	var model_list = blessed.list( {
		parent: screen,
		top: 2,
		left: 0,
		width: '20%',
		height: '70%-3',
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
	// Test List (middle panel, 25%)
	//---------------------------------------------------------------------

	var test_label = blessed.box( {
		parent: screen,
		top: 1,
		left: '20%',
		width: '25%',
		height: 1,
		content: ' TESTS',
		tags: true,
		style: { fg: current_theme.label.fg, bg: current_theme.label.bg, bold: true },
	} );

	var test_list = blessed.list( {
		parent: screen,
		top: 2,
		left: '20%',
		width: '25%',
		height: '70%-3',
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
	// Detail Panel (right panel, 55%)
	//---------------------------------------------------------------------

	var detail_label = blessed.box( {
		parent: screen,
		top: 1,
		left: '45%',
		width: '55%',
		height: 1,
		content: ' DETAIL',
		tags: true,
		style: { fg: current_theme.label.fg, bg: current_theme.label.bg, bold: true },
	} );

	var detail_panel = blessed.box( {
		parent: screen,
		top: 2,
		left: '45%',
		width: '55%',
		height: '70%-3',
		border: { type: 'line' },
		tags: true,
		keys: true,
		vi: true,
		mouse: true,
		scrollable: true,
		alwaysScroll: true,
		scrollbar: { ch: ' ', style: { bg: 'gray' } },
		label: ' Select a test ',
		style: {
			fg: current_theme.detail.fg,
			bg: current_theme.detail.bg,
			border: { fg: current_theme.panel_border.fg },
			label: { fg: current_theme.secondary },
			focus: { border: { fg: 'green' } },
		},
		content: '',
	} );


	//---------------------------------------------------------------------
	// Log Panel (bottom)
	//---------------------------------------------------------------------

	var log_panel = blessed.log( {
		parent: screen,
		top: '70%-1',
		left: 0,
		width: '100%',
		height: '30%-1',
		border: { type: 'line' },
		tags: true,
		keys: true,
		vi: true,
		mouse: true,
		scrollable: true,
		scrollbar: { ch: ' ', style: { bg: 'gray' } },
		label: ' Log ',
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
		var parts = [];
		parts.push( '{bold}q{/bold}:Quit' );
		parts.push( '{bold}\u2190\u2192{/bold}:Pane' );
		parts.push( '{bold}Enter{/bold}:Run' );
		parts.push( '{bold}a{/bold}:All' );
		parts.push( '{bold}+/-{/bold}:Section  {bold}Space{/bold}:Toggle' );
		parts.push( '{bold}c{/bold}:Compare' );
		parts.push( '{bold}r{/bold}:Results' );
		parts.push( '{bold}l{/bold}:Log' );
		parts.push( '{bold}t{/bold}:Theme' );
		parts.push( '{bold}x{/bold}:Cancel' );
		parts.push( '{bold}d{/bold}:Clear' );
		status_bar.setContent( ' ' + parts.join( '  ' ) );
	}

	update_status_bar();


	//---------------------------------------------------------------------
	// Comparison Overlay
	//---------------------------------------------------------------------

	var comparison_table = blessed.listtable( {
		parent: screen,
		top: 'center',
		left: 'center',
		width: '90%',
		height: '80%',
		border: { type: 'line' },
		tags: true,
		keys: true,
		vi: true,
		mouse: true,
		scrollable: true,
		label: ' Comparison (Esc to close) ',
		hidden: true,
		style: {
			fg: 'white',
			bg: 'black',
			border: { fg: 'cyan' },
			label: { fg: 'cyan' },
			header: { fg: 'cyan', bold: true },
			cell: { fg: 'white' },
		},
	} );


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
	// Panel focus management
	//---------------------------------------------------------------------

	panels = [ model_list, test_list, detail_panel ];
	var panel_labels = [ model_label, test_label, detail_label ];

	function resize_panels( FocusedIndex )
	{
		// Focused panel gets 60%, the other two get 20% each
		var widths = [ '20%', '20%', '20%' ];
		widths[ FocusedIndex ] = '60%';

		// Compute left positions based on widths
		var lefts = [];
		if ( FocusedIndex === 0 )
		{
			lefts = [ 0, '60%', '80%' ];
		}
		else if ( FocusedIndex === 1 )
		{
			lefts = [ 0, '20%', '80%' ];
		}
		else
		{
			lefts = [ 0, '20%', '40%' ];
		}

		for ( var i = 0; i < panels.length; i++ )
		{
			panels[ i ].left = lefts[ i ];
			panels[ i ].width = widths[ i ];
			panel_labels[ i ].left = lefts[ i ];
			panel_labels[ i ].width = widths[ i ];
		}
	}

	function focus_panel( Index )
	{
		if ( comparison_table.visible ) { return; }
		if ( Index < 0 ) { Index = panels.length - 1; }
		if ( Index >= panels.length ) { Index = 0; }
		current_panel_index = Index;
		resize_panels( Index );
		panels[ current_panel_index ].focus();
		screen.render();
	}


	//---------------------------------------------------------------------
	// Log visibility toggle
	//---------------------------------------------------------------------

	function toggle_log()
	{
		log_visible = !log_visible;
		if ( log_visible )
		{
			log_panel.show();
			model_list.height = '70%-3';
			test_list.height = '70%-3';
			detail_panel.height = '70%-3';
		}
		else
		{
			log_panel.hide();
			model_list.height = '100%-4';
			test_list.height = '100%-4';
			detail_panel.height = '100%-4';
		}
		screen.render();
	}


	//---------------------------------------------------------------------
	// Populate widgets with data
	//---------------------------------------------------------------------

	function set_models( Models )
	{
		var items = [];
		for ( var index = 0; index < Models.length; index++ )
		{
			var model = Models[ index ];
			var params = model.ModelParameters ? model.ModelParameters + 'B' : '';
			var sc = current_theme.secondary;
			items.push( ' ' + model.ModelName + '  {' + sc + '-fg}' + model.Platform + ' ' + params + '{/' + sc + '-fg}' );
		}
		model_list.setItems( items );
		if ( items.length > 0 ) { model_list.select( 0 ); }
		screen.render();
	}

	function set_test_groups( TestGroups )
	{
		test_statuses = {};

		// Initialize group collapse states (default expanded)
		for ( var g = 0; g < TestGroups.length; g++ )
		{
			var group = TestGroups[ g ];
			if ( group_collapse_states[ group.Name ] === undefined )
			{
				group_collapse_states[ group.Name ] = false;
			}
			for ( var t = 0; t < group.Tests.length; t++ )
			{
				var full_name = group.Name + '/' + group.Tests[ t ].Name;
				test_statuses[ full_name ] = { status: 'pending', duration: 0 };
			}
		}

		rebuild_test_list();
	}

	function rebuild_test_list()
	{
		var groups = Options.TestGroups || [];
		visible_items = [];
		var items = [];

		for ( var g = 0; g < groups.length; g++ )
		{
			var group = groups[ g ];
			var collapsed = group_collapse_states[ group.Name ];
			visible_items.push( { type: 'group', group_name: group.Name, test_name: null, full_name: null } );
			items.push( format_group_header( group.Name, collapsed ) );

			if ( !collapsed )
			{
				for ( var t = 0; t < group.Tests.length; t++ )
				{
					var test = group.Tests[ t ];
					var full_name = group.Name + '/' + test.Name;
					visible_items.push( { type: 'test', group_name: group.Name, test_name: test.Name, full_name: full_name } );

					var info = test_statuses[ full_name ] || { status: 'pending', duration: 0 };
					items.push( format_test_item( test.Name, info.status, info.duration ) );
				}
			}
		}

		test_list.setItems( items );
		screen.render();
	}

	function format_group_header( GroupName, Collapsed )
	{
		var marker = Collapsed ? '[+]' : '[-]';
		var group_summary = get_group_summary( GroupName );
		var ac = current_theme.accent;
		return ' {' + ac + '-fg}{bold}' + marker + ' ' + GroupName + '{/bold}{/' + ac + '-fg}' + group_summary;
	}

	function get_group_summary( GroupName )
	{
		var groups = Options.TestGroups || [];
		var group = null;
		for ( var g = 0; g < groups.length; g++ )
		{
			if ( groups[ g ].Name === GroupName ) { group = groups[ g ]; break; }
		}
		if ( !group ) { return ''; }

		var passed = 0;
		var failed = 0;
		var total = group.Tests.length;

		for ( var t = 0; t < group.Tests.length; t++ )
		{
			var full_name = GroupName + '/' + group.Tests[ t ].Name;
			var info = test_statuses[ full_name ];
			if ( info )
			{
				if ( info.status === 'pass' ) { passed++; }
				else if ( info.status === 'fail' ) { failed++; }
			}
		}

		if ( passed === 0 && failed === 0 ) { return ''; }
		var sc = current_theme.secondary;
		return '  {' + sc + '-fg}' + passed + '/' + total + '{/' + sc + '-fg}';
	}

	function format_test_item( Name, Status, DurationMs )
	{
		var status_label = current_theme.pending;
		if ( Status === 'pass' ) { status_label = current_theme.pass; }
		else if ( Status === 'fail' ) { status_label = current_theme.fail; }
		else if ( Status === 'running' ) { status_label = current_theme.run; }

		var duration_label = '';
		if ( DurationMs > 0 )
		{
			var sc = current_theme.secondary;
			duration_label = '  {' + sc + '-fg}' + ( DurationMs / 1000 ).toFixed( 1 ) + 's{/' + sc + '-fg}';
		}

		return '     ' + status_label + '  ' + Name + duration_label;
	}


	//---------------------------------------------------------------------
	// Detail panel rendering with collapsible sections
	//---------------------------------------------------------------------

	// Get or create section state for a test
	function get_section_state( TestName, SectionCount )
	{
		if ( !detail_sections[ TestName ] )
		{
			var sections = [];
			for ( var i = 0; i < SectionCount; i++ )
			{
				sections.push( { collapsed: true } );
			}
			detail_sections[ TestName ] = { sections: sections };
		}
		// Grow if needed (more sections than last render)
		var state = detail_sections[ TestName ];
		while ( state.sections.length < SectionCount )
		{
			state.sections.push( { collapsed: true } );
		}
		return state;
	}

	// Track section header lines for toggling
	var current_section_headers = [];
	var current_test_name = null;
	var active_header_index = 0;

	function render_detail( TestName )
	{
		current_test_name = TestName;
		current_section_headers = [];

		var data = test_interchanges[ TestName ];
		if ( !data || data.length === 0 )
		{
			active_header_index = 0;
			detail_panel.setLabel( ' ' + TestName + ' ' );
			var sc = current_theme.secondary;
			detail_panel.setContent( '{' + sc + '-fg}No interchange data yet. Run this test first.{/' + sc + '-fg}' );
			screen.render();
			return;
		}

		// Theme color shortcuts
		var hc = current_theme.heading;
		var cc = current_theme.cursor;
		var ph = current_theme.prompt_heading;
		var th = current_theme.tool_heading;
		var ac = current_theme.args;
		var sc = current_theme.secondary;

		// Count total collapsible sections: 1 prompt + N tool calls per chat entry
		var section_index = 0;
		var total_sections = 0;
		for ( var i = 0; i < data.length; i++ )
		{
			total_sections++; // prompt
			total_sections += ( data[ i ].ToolCalls ? data[ i ].ToolCalls.length : 0 );
		}

		var state = get_section_state( TestName, total_sections );

		// Clamp active header index
		if ( active_header_index < 0 ) { active_header_index = 0; }

		var lines = [];
		var header_counter = 0;
		section_index = 0;

		for ( var i = 0; i < data.length; i++ )
		{
			var entry = data[ i ];

			// Chat header
			lines.push( '{' + hc + '-fg}{bold}--- Chat ' + ( i + 1 ) + ' ---{/bold}{/' + hc + '-fg}' );
			lines.push( '' );

			// User prompt (always visible)
			lines.push( '{bold}User:{/bold} ' + entry.Text );
			lines.push( '' );

			// Prompt (collapsible)
			if ( entry.Prompt )
			{
				var prompt_collapsed = state.sections[ section_index ].collapsed;
				var prompt_marker = prompt_collapsed ? '[+]' : '[-]';
				var is_active = ( header_counter === active_header_index );
				var cursor = is_active ? '{' + cc + '-fg}{bold}>{/bold}{/' + cc + '-fg} ' : '  ';
				var prompt_header_line = lines.length;
				lines.push( cursor + '{' + ph + '-fg}' + prompt_marker + ' {bold}Prompt{/bold}{/' + ph + '-fg}' );
				current_section_headers.push( { line: prompt_header_line, section_index: section_index } );
				header_counter++;

				if ( !prompt_collapsed )
				{
					lines.push( '' );
					var prompt_lines = entry.Prompt.split( '\n' );
					for ( var p = 0; p < prompt_lines.length; p++ )
					{
						lines.push( prompt_lines[ p ] );
					}
				}
				lines.push( '' );
			}
			section_index++;

			// Tool calls (each collapsible)
			if ( entry.ToolCalls && entry.ToolCalls.length > 0 )
			{
				lines.push( '{' + th + '-fg}{bold}Tool Calls (' + entry.ToolCalls.length + '):{/bold}{/' + th + '-fg}' );
				lines.push( '' );

				for ( var t = 0; t < entry.ToolCalls.length; t++ )
				{
					var tc = entry.ToolCalls[ t ];
					var tc_status = tc.Success ? '{green-fg}OK{/green-fg}' : '{red-fg}FAIL{/red-fg}';
					var tc_duration = tc.Duration ? ' (' + ( tc.Duration / 1000 ).toFixed( 1 ) + 's)' : '';
					var tc_collapsed = state.sections[ section_index ].collapsed;
					var tc_marker = tc_collapsed ? '[+]' : '[-]';
					var is_active = ( header_counter === active_header_index );
					var cursor = is_active ? '{' + cc + '-fg}{bold}>{/bold}{/' + cc + '-fg} ' : '  ';

					var tc_header_line = lines.length;
					lines.push( cursor + '{' + th + '-fg}' + tc_marker + '{/' + th + '-fg}  {bold}' + ( t + 1 ) + '. ' + tc.Tool + '{/bold}  ' + tc_status + tc_duration );
					current_section_headers.push( { line: tc_header_line, section_index: section_index } );
					header_counter++;

					if ( !tc_collapsed )
					{
						// Arguments
						lines.push( '' );
						lines.push( '     {' + ac + '-fg}{bold}Arguments:{/bold}{/' + ac + '-fg}' );
						var args_text = JSON.stringify( tc.Arguments, null, 2 );
						var args_lines = args_text.split( '\n' );
						for ( var a = 0; a < args_lines.length; a++ )
						{
							lines.push( '     {' + ac + '-fg}' + args_lines[ a ] + '{/' + ac + '-fg}' );
						}

						// Result
						if ( tc.Success && tc.Result )
						{
							lines.push( '' );
							lines.push( '     {green-fg}{bold}Result:{/bold}{/green-fg}' );
							var result_text = JSON.stringify( tc.Result, null, 2 );
							var result_lines = result_text.split( '\n' );
							for ( var r = 0; r < result_lines.length; r++ )
							{
								lines.push( '     ' + result_lines[ r ] );
							}
						}
						else if ( tc.Error )
						{
							lines.push( '' );
							lines.push( '     {red-fg}Error: ' + tc.Error + '{/red-fg}' );
						}
					}

					lines.push( '' );
					section_index++;
				}
			}

			// Response (always visible)
			lines.push( '{green-fg}{bold}Response:{/bold}{/green-fg}' );
			lines.push( entry.Response );
			lines.push( '' );
		}

		// Clamp after counting actual headers
		if ( active_header_index >= current_section_headers.length )
		{
			active_header_index = Math.max( 0, current_section_headers.length - 1 );
		}

		detail_panel.setLabel( ' ' + TestName + '  {' + sc + '-fg}+/-: section  Space: toggle{/' + sc + '-fg} ' );
		detail_panel.setContent( lines.join( '\n' ) );
		screen.render();
	}

	// Move the active section cursor and scroll to it
	function move_active_header( Direction )
	{
		if ( current_section_headers.length === 0 ) { return; }

		active_header_index += Direction;
		if ( active_header_index < 0 ) { active_header_index = 0; }
		if ( active_header_index >= current_section_headers.length )
		{
			active_header_index = current_section_headers.length - 1;
		}

		render_detail( current_test_name );

		// Scroll so the active header is visible
		var header = current_section_headers[ active_header_index ];
		if ( header )
		{
			detail_panel.scrollTo( header.line );
			screen.render();
		}
	}

	// Toggle the currently active section
	function toggle_detail_section()
	{
		if ( !current_test_name || current_section_headers.length === 0 ) { return; }
		if ( active_header_index < 0 || active_header_index >= current_section_headers.length ) { return; }

		var section_index = current_section_headers[ active_header_index ].section_index;
		var state = detail_sections[ current_test_name ];
		if ( !state || !state.sections[ section_index ] ) { return; }

		state.sections[ section_index ].collapsed = !state.sections[ section_index ].collapsed;

		render_detail( current_test_name );

		// Scroll to the active header in the re-rendered content
		var header = current_section_headers[ active_header_index ];
		if ( header )
		{
			detail_panel.scrollTo( header.line );
			screen.render();
		}
	}

	// +/- keys move the active section cursor (screen-level so they work regardless of focus)
	screen.key( [ '+', '=' ], function ()
	{
		if ( comparison_table.visible ) { return; }
		move_active_header( 1 );
	} );

	screen.key( [ '-' ], function ()
	{
		if ( comparison_table.visible ) { return; }
		move_active_header( -1 );
	} );

	// Update detail when test selection changes
	test_list.on( 'select item', function ()
	{
		var selected = test_list.selected;
		if ( selected >= 0 && selected < visible_items.length )
		{
			var item = visible_items[ selected ];
			if ( item.type === 'test' )
			{
				active_header_index = 0;
				render_detail( item.full_name );
			}
		}
	} );


	//---------------------------------------------------------------------
	// Public methods
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

	function set_test_status( FullName, Status, DurationMs )
	{
		test_statuses[ FullName ] = { status: Status, duration: DurationMs };
		rebuild_test_list();
	}

	function set_test_interchange( FullName, Interchange )
	{
		test_interchanges[ FullName ] = Interchange;

		// If this test is currently selected, refresh the detail pane
		var selected = test_list.selected;
		if ( selected >= 0 && selected < visible_items.length )
		{
			var item = visible_items[ selected ];
			if ( item.type === 'test' && item.full_name === FullName )
			{
				render_detail( FullName );
			}
		}
	}

	function reset_test_statuses()
	{
		var groups = Options.TestGroups || [];
		for ( var g = 0; g < groups.length; g++ )
		{
			var group = groups[ g ];
			for ( var t = 0; t < group.Tests.length; t++ )
			{
				var full_name = group.Name + '/' + group.Tests[ t ].Name;
				test_statuses[ full_name ] = { status: 'pending', duration: 0 };
			}
		}
		test_interchanges = {};
		detail_sections = {};
		current_section_headers = [];
		current_test_name = null;
		detail_panel.setLabel( ' Select a test ' );
		detail_panel.setContent( '' );
		rebuild_test_list();
	}

	function show_comparison( ComparisonData )
	{
		if ( !ComparisonData.Models.length )
		{
			log_message( 'No results to compare.' );
			return;
		}

		// Build table: header row + one row per model
		var header = [ 'Model' ];
		for ( var t = 0; t < ComparisonData.Tests.length; t++ )
		{
			var short_name = ComparisonData.Tests[ t ].substring( 0, 3 );
			header.push( short_name );
		}
		header.push( 'Score' );

		var rows = [ header ];

		for ( var m = 0; m < ComparisonData.Models.length; m++ )
		{
			var model = ComparisonData.Models[ m ];
			var model_grid = ComparisonData.Grid[ model.ModelName ] || {};
			var row = [ model.ModelName ];
			var passed_count = 0;

			for ( var t = 0; t < ComparisonData.Tests.length; t++ )
			{
				var cell = model_grid[ ComparisonData.Tests[ t ] ];
				if ( cell )
				{
					var duration_str = ( cell.DurationMs / 1000 ).toFixed( 1 );
					if ( cell.Passed )
					{
						row.push( 'OK ' + duration_str + 's' );
						passed_count++;
					}
					else
					{
						row.push( 'FAIL' );
					}
				}
				else
				{
					row.push( '--' );
				}
			}
			row.push( passed_count + '/' + ComparisonData.Tests.length );
			rows.push( row );
		}

		comparison_table.setData( rows );
		comparison_table.show();
		comparison_table.focus();
		screen.render();
	}

	function show_results( ResultRows )
	{
		if ( !ResultRows.length )
		{
			log_message( 'No results for this model.' );
			return;
		}

		log_message( '--- Results History ---' );
		for ( var index = 0; index < ResultRows.length; index++ )
		{
			var row = ResultRows[ index ];
			var status_label = row.Passed ? 'PASS' : 'FAIL';
			var duration_label = ( row.DurationMs / 1000 ).toFixed( 1 ) + 's';
			log_message( row.Timestamp + '  ' + status_label + '  ' + row.TestName + '  ' + duration_label );
		}
		log_message( '--- End ---' );
	}


	//---------------------------------------------------------------------
	// Key bindings
	//---------------------------------------------------------------------

	// Quit
	screen.key( [ 'q', 'C-c' ], function ()
	{
		screen.destroy();
		process.exit( 0 );
	} );

	// Tab / Right arrow - next panel
	screen.key( [ 'tab', 'right' ], function ()
	{
		if ( comparison_table.visible ) { return; }
		focus_panel( current_panel_index + 1 );
	} );

	// Shift-Tab / Left arrow - previous panel
	screen.key( [ 'S-tab', 'left' ], function ()
	{
		if ( comparison_table.visible ) { return; }
		focus_panel( current_panel_index - 1 );
	} );

	// Space - toggle group in test list, or collapsible section in detail panel
	screen.key( [ 'space' ], function ()
	{
		if ( comparison_table.visible ) { return; }

		if ( test_list === screen.focused )
		{
			var selected = test_list.selected;
			if ( selected >= 0 && selected < visible_items.length )
			{
				var item = visible_items[ selected ];
				if ( item.type === 'group' )
				{
					group_collapse_states[ item.group_name ] = !group_collapse_states[ item.group_name ];
					rebuild_test_list();
					// Re-select the group header
					for ( var i = 0; i < visible_items.length; i++ )
					{
						if ( visible_items[ i ].type === 'group' && visible_items[ i ].group_name === item.group_name )
						{
							test_list.select( i );
							break;
						}
					}
					screen.render();
				}
			}
		}
		else if ( detail_panel === screen.focused )
		{
			toggle_detail_section();
		}
	} );

	// Enter - run selected test, group, or all tests
	screen.key( [ 'enter' ], function ()
	{
		if ( comparison_table.visible ) { return; }

		var model_index = model_list.selected;
		if ( model_index === undefined || model_index < 0 ) { return; }

		if ( test_list === screen.focused )
		{
			var selected = test_list.selected;
			if ( selected >= 0 && selected < visible_items.length )
			{
				var item = visible_items[ selected ];
				if ( item.type === 'group' && Options.OnRunGroup )
				{
					Options.OnRunGroup( model_index, item.group_name );
				}
				else if ( item.type === 'test' && Options.OnRunTest )
				{
					Options.OnRunTest( model_index, item.group_name, item.test_name );
				}
			}
		}
		else if ( model_list === screen.focused )
		{
			if ( Options.OnRunAll )
			{
				Options.OnRunAll( model_index );
			}
		}
	} );

	// a - run all tests
	screen.key( [ 'a' ], function ()
	{
		if ( comparison_table.visible ) { return; }
		var model_index = model_list.selected;
		if ( model_index === undefined || model_index < 0 ) { return; }
		if ( Options.OnRunAll )
		{
			Options.OnRunAll( model_index );
		}
	} );

	// c - comparison view
	screen.key( [ 'c' ], function ()
	{
		if ( comparison_table.visible )
		{
			comparison_table.hide();
			focus_panel( current_panel_index );
		}
		else if ( Options.OnCompare )
		{
			Options.OnCompare();
		}
	} );

	// r - results history
	screen.key( [ 'r' ], function ()
	{
		if ( comparison_table.visible ) { return; }
		var model_index = model_list.selected;
		if ( model_index === undefined || model_index < 0 ) { return; }
		if ( Options.OnResults )
		{
			Options.OnResults( model_index );
		}
	} );

	// l - toggle log visibility
	screen.key( [ 'l' ], function ()
	{
		toggle_log();
	} );

	// t - toggle theme
	screen.key( [ 't' ], function ()
	{
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

	// x - cancel running tests
	screen.key( [ 'x' ], function ()
	{
		if ( Options.OnCancel )
		{
			Options.OnCancel();
		}
	} );

	// d - clear stored results (with confirmation)
	screen.key( [ 'd' ], function ()
	{
		if ( comparison_table.visible ) { return; }
		if ( !Options.OnClear ) { return; }

		confirm_dialog.ask( 'Clear all stored results? (y/n)', function ( err, confirmed )
		{
			if ( confirmed )
			{
				Options.OnClear();
				log_message( 'Results cleared.' );
			}
			focus_panel( current_panel_index );
		} );
	} );

	// Escape closes comparison overlay
	screen.key( [ 'escape' ], function ()
	{
		if ( comparison_table.visible )
		{
			comparison_table.hide();
			focus_panel( current_panel_index );
		}
		else
		{
			screen.destroy();
			process.exit( 0 );
		}
	} );


	//---------------------------------------------------------------------
	// Apply theme to all widgets
	//---------------------------------------------------------------------

	function apply_theme()
	{
		title_bar.style.bg = current_theme.title_bar.bg;
		title_bar.style.fg = current_theme.title_bar.fg;

		model_label.style.fg = current_theme.label.fg;
		model_label.style.bg = current_theme.label.bg;
		test_label.style.fg = current_theme.label.fg;
		test_label.style.bg = current_theme.label.bg;
		detail_label.style.fg = current_theme.label.fg;
		detail_label.style.bg = current_theme.label.bg;

		model_list.style.fg = current_theme.panel.fg;
		model_list.style.bg = current_theme.panel.bg;
		model_list.style.border.fg = current_theme.panel_border.fg;
		model_list.style.selected = current_theme.selected;

		test_list.style.fg = current_theme.panel.fg;
		test_list.style.bg = current_theme.panel.bg;
		test_list.style.border.fg = current_theme.panel_border.fg;
		test_list.style.selected = current_theme.selected;

		detail_panel.style.fg = current_theme.detail.fg;
		detail_panel.style.bg = current_theme.detail.bg;
		detail_panel.style.border.fg = current_theme.panel_border.fg;
		detail_panel.style.label.fg = current_theme.secondary;

		log_panel.style.fg = current_theme.log.fg;
		log_panel.style.bg = current_theme.log.bg;
		log_panel.style.border.fg = current_theme.panel_border.fg;
		log_panel.style.label.fg = current_theme.label.fg;

		status_bar.style.fg = current_theme.status_bar.fg;
		status_bar.style.bg = current_theme.status_bar.bg;

		// Refresh model items with new theme colors
		set_models( Options.Models || [] );

		// Refresh test items with new theme colors
		rebuild_test_list();

		// Refresh detail pane if showing
		if ( current_test_name )
		{
			render_detail( current_test_name );
		}
	}


	//---------------------------------------------------------------------
	// Initialize
	//---------------------------------------------------------------------

	set_models( Options.Models || [] );
	set_test_groups( Options.TestGroups || [] );
	resize_panels( 0 );
	model_list.focus();
	screen.render();


	//---------------------------------------------------------------------
	// Return public interface
	//---------------------------------------------------------------------

	return {
		Screen: screen,
		Log: log_message,
		SetTestStatus: set_test_status,
		SetTestInterchange: set_test_interchange,
		ResetTestStatuses: reset_test_statuses,
		SetModels: set_models,
		ShowComparison: show_comparison,
		ShowResults: show_results,
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
