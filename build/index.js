/**
 * Giant Posts Archive — Editor script (no build step).
 */
( function () {
	'use strict';

	if ( ! window.wp || ! window.wp.blocks || ! window.wp.element ) return;

	var __             = wp.i18n.__;
	var el             = wp.element.createElement;
	var useState       = wp.element.useState;
	var useEffect      = wp.element.useEffect;
	var Fragment       = wp.element.Fragment;

	var useBlockProps     = wp.blockEditor.useBlockProps;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var useSettings       = wp.blockEditor.useSettings;

	var PanelBody     = wp.components.PanelBody;
	var SelectControl = wp.components.SelectControl;
	var RangeControl  = wp.components.RangeControl;
	var TextControl   = wp.components.TextControl;
	var ColorPicker   = wp.components.ColorPicker;
	var ColorPalette  = wp.components.ColorPalette;
	var Spinner       = wp.components.Spinner;

	var apiFetch         = wp.apiFetch;
	var registerBlockType = wp.blocks.registerBlockType;

	/* ── Colour field: theme palette swatches + custom picker ── */
	var CHECKERBOARD = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'8\' height=\'8\'%3E%3Crect width=\'4\' height=\'4\' fill=\'%23ccc\'/%3E%3Crect x=\'4\' y=\'4\' width=\'4\' height=\'4\' fill=\'%23ccc\'/%3E%3C/svg%3E")';

	function ColourField( props ) {
		var settingsResult = useSettings( 'color.palette' );
		var themePalette   = ( settingsResult && settingsResult[0] ) || [];

		var customState  = useState( false );
		var showCustom   = customState[0];
		var setShowCustom = customState[1];

		var isTransparent = ! props.value || props.value === 'transparent';

		var swatchStyle = {
			display:      'inline-block',
			width:        18,
			height:       18,
			borderRadius: 2,
			border:       '1px solid rgba(0,0,0,0.15)',
			flexShrink:   0,
			background:   isTransparent ? CHECKERBOARD + ', #fff' : props.value,
		};

		return el( 'div', { style: { marginBottom: 16 } },
			el( 'p', { style: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8, color: '#757575' } }, props.label ),
			el( 'div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 } },
				el( 'span', { style: swatchStyle } ),
				el( 'span', { style: { fontSize: 12, color: '#444' } }, isTransparent ? 'Transparent' : props.value )
			),
			el( ColorPalette, {
				colors:              themePalette,
				value:               ( ! isTransparent && props.value ) || '',
				onChange: function ( v ) {
					props.onChange( v || 'transparent' );
					setShowCustom( false );
				},
				disableCustomColors: true,
				clearable:           false,
			} ),
			el( 'button', {
				type:    'button',
				onClick: function () { setShowCustom( ! showCustom ); },
				style:   { fontSize: 12, color: '#1a9ad6', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline', display: 'block', marginTop: 4 },
			}, showCustom ? 'Hide custom colour' : 'Custom colour…' ),
			showCustom && el( 'div', { style: { marginTop: 8, border: '1px solid #e0e0e0', borderRadius: 4, overflow: 'hidden' } },
				el( ColorPicker, {
					color:       ( ! isTransparent && props.value ) || '#ffffff',
					enableAlpha: true,
					onChange: function ( v ) { props.onChange( v ); },
				} ),
				el( 'div', { style: { padding: '4px 12px 10px' } },
					el( 'button', {
						type:    'button',
						onClick: function () { props.onChange( 'transparent' ); setShowCustom( false ); },
						style:   { fontSize: 12, color: '#1a9ad6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' },
					}, 'Set transparent' )
				)
			)
		);
	}

	/* ── Editor preview card ── */
	function PreviewCard( props ) {
		return el( 'div', { className: 'blog-item' },
			el( 'div', { className: 'blog-inner' },
				el( 'div', {
					className: 'blog-featured-image',
					style: {
						backgroundImage: 'linear-gradient(135deg, #e0e0e0 0%, #c0c0c0 100%)',
						backgroundPosition: 'center',
					},
				} ),
				el( 'div', { className: 'blog-details' },
					el( 'div', { className: 'blog-date' },
						'01/01/25',
						el( 'div', { className: 'calendar-icon' } )
					),
					el( 'h4', { className: 'blog-title' }, __( 'Post title goes here', 'giant-posts-archive' ) ),
					el( 'div', { className: 'excerpt' }, __( 'A short excerpt from the post content will appear here...', 'giant-posts-archive' ) ),
					el( 'a', {
						href: '#',
						className: 'btn blog-btn',
						onClick: function ( e ) { e.preventDefault(); },
					}, __( 'Read more', 'giant-posts-archive' ) )
				)
			)
		);
	}

	/* ── Filter bar preview ── */
	function FilterBarPreview() {
		return el( 'div', { className: 'gpa-filter-bar' },
			el( 'div', { className: 'gpa-filter-group' },
				el( 'span', { className: 'gpa-filter-label' }, __( 'Order by date:', 'giant-posts-archive' ) ),
				el( 'div', { className: 'gpa-select-wrap' },
					el( 'select', { className: 'gpa-select', disabled: true },
						el( 'option', null, __( 'Newest first', 'giant-posts-archive' ) )
					)
				)
			),
			el( 'div', { className: 'gpa-filter-group' },
				el( 'span', { className: 'gpa-filter-label' }, __( 'Category:', 'giant-posts-archive' ) ),
				el( 'div', { className: 'gpa-select-wrap' },
					el( 'select', { className: 'gpa-select', disabled: true },
						el( 'option', null, __( 'All categories', 'giant-posts-archive' ) )
					)
				)
			),
			el( 'button', { className: 'gpa-filter-btn', disabled: true }, __( 'Filter', 'giant-posts-archive' ) )
		);
	}

	/* ── Main Block ── */
	registerBlockType( 'giant-posts-archive/posts-archive', {

		attributes: {
			postType:      { type: 'string',  default: 'post' },
			postsPerPage:  { type: 'integer', default: 6 },
			heading:       { type: 'string',  default: '' },
			className:     { type: 'string',  default: '' },
			accentColor:   { type: 'string',  default: '' },
			cardBgColor:   { type: 'string',  default: '' },
			filterBtnColor: { type: 'string', default: '' },
		},

		edit: function ( props ) {
			var attrs    = props.attributes;
			var setAttrs = props.setAttributes;

			var postTypeState   = useState( [] );
			var postTypeOptions = postTypeState[0];
			var setPostTypes    = postTypeState[1];

			var loadingState = useState( true );
			var loading      = loadingState[0];
			var setLoading   = loadingState[1];

			useEffect( function () {
				apiFetch( { path: '/giant-posts-archive/v1/post-types' } )
					.then( function ( types ) {
						setPostTypes( types );
						setLoading( false );
					} )
					.catch( function () {
						setLoading( false );
					} );
			}, [] );

			var blockProps = useBlockProps( { className: 'posts-archive gpa-editor-preview' } );

			var previewCards = [];
			var count = Math.min( attrs.postsPerPage, 6 );
			for ( var i = 0; i < count; i++ ) {
				previewCards.push( el( PreviewCard, { key: i, index: i } ) );
			}

			var clientId    = props.clientId;
			var scopeClass  = 'gpa-instance-' + clientId.replace( /-/g, '' ).slice( 0, 8 );
			var inlineStyle = '';
			if ( attrs.accentColor ) {
				inlineStyle += '.' + scopeClass + ' .blog-date,' +
					'.' + scopeClass + ' .blog-btn,' +
					'.' + scopeClass + ' .gpa-select,' +
					'.' + scopeClass + ' .gpa-page-btn,' +
					'.' + scopeClass + ' .gpa-page-num { color:' + attrs.accentColor + '; border-color:' + attrs.accentColor + '; }' +
					'.' + scopeClass + ' .gpa-select { border-bottom-color:' + attrs.accentColor + '; }' +
					'.' + scopeClass + ' .gpa-page-num.active { background:' + attrs.accentColor + '; color:#fff; }';
			}
			if ( attrs.cardBgColor ) {
				inlineStyle += '.' + scopeClass + ' .blog-inner { background-color:' + attrs.cardBgColor + '; }';
			}
			if ( attrs.filterBtnColor ) {
				inlineStyle += '.' + scopeClass + ' .gpa-filter-btn { background-color:' + attrs.filterBtnColor + '; }';
			}

			var inspectorPanel = el( InspectorControls, null,

				el( PanelBody, { title: __( 'Query Settings', 'giant-posts-archive' ), initialOpen: true },

					loading
						? el( Spinner )
						: el( SelectControl, {
							label:    __( 'Post Type', 'giant-posts-archive' ),
							value:    attrs.postType,
							options:  postTypeOptions,
							onChange: function ( v ) { setAttrs( { postType: v } ); },
						} ),

					el( RangeControl, {
						label:    __( 'Posts per page', 'giant-posts-archive' ),
						value:    attrs.postsPerPage,
						onChange: function ( v ) { setAttrs( { postsPerPage: v } ); },
						min:      1,
						max:      24,
					} )
				),

				el( PanelBody, { title: __( 'Labels', 'giant-posts-archive' ), initialOpen: false },
					el( TextControl, {
						label:    __( 'Section heading (optional)', 'giant-posts-archive' ),
						value:    attrs.heading,
						onChange: function ( v ) { setAttrs( { heading: v } ); },
					} )
				),

				el( PanelBody, { title: __( 'Colours', 'giant-posts-archive' ), initialOpen: false },
					el( ColourField, {
						label:    __( 'Accent colour', 'giant-posts-archive' ),
						value:    attrs.accentColor,
						onChange: function ( v ) { setAttrs( { accentColor: v } ); },
					} ),
					el( ColourField, {
						label:    __( 'Card background', 'giant-posts-archive' ),
						value:    attrs.cardBgColor,
						onChange: function ( v ) { setAttrs( { cardBgColor: v } ); },
					} ),
					el( ColourField, {
						label:    __( 'Filter button colour', 'giant-posts-archive' ),
						value:    attrs.filterBtnColor,
						onChange: function ( v ) { setAttrs( { filterBtnColor: v } ); },
					} )
				)
			);

			var mergedProps = Object.assign( {}, blockProps, {
				className: ( blockProps.className || '' ) + ' ' + scopeClass,
			} );

			var editorBlock = el( 'section', mergedProps,
				inlineStyle && el( 'style', null, inlineStyle ),
				el( 'div', { className: 'container' },
					attrs.heading && el( 'h3', { className: 'loop-heading' }, attrs.heading ),
					el( FilterBarPreview ),
					el( 'div', { className: 'loop-content' }, previewCards )
				)
			);

			return el( Fragment, null, inspectorPanel, editorBlock );
		},

		save: function () {
			return null;
		},
	} );

} )();
