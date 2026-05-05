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

	var PanelBody     = wp.components.PanelBody;
	var SelectControl = wp.components.SelectControl;
	var RangeControl  = wp.components.RangeControl;
	var TextControl   = wp.components.TextControl;
	var Spinner       = wp.components.Spinner;

	var apiFetch         = wp.apiFetch;
	var registerBlockType = wp.blocks.registerBlockType;

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
				)
			);

			var editorBlock = el( 'section', blockProps,
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
