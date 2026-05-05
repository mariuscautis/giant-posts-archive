/**
 * Giant Posts Archive — Frontend: filter + pagination via AJAX.
 */
( function () {
	'use strict';

	document.addEventListener( 'DOMContentLoaded', function () {
		var archives = document.querySelectorAll( '.posts-archive' );
		archives.forEach( initArchive );
	} );

	function initArchive( archive ) {
		var grid       = archive.querySelector( '.gpa-posts-grid' );
		var pagination = archive.querySelector( '.gpa-pagination' );
		var filterBtn  = archive.querySelector( '#gpa-filter-trigger' );
		var orderSel   = archive.querySelector( '#gpa-order' );
		var catSel     = archive.querySelector( '#gpa-category' );

		if ( ! grid ) return;

		var postType     = archive.dataset.postType     || 'post';
		var postsPerPage = archive.dataset.postsPerPage || 6;
		var currentPage  = 1;

		function fetchPosts( page ) {
			var order    = orderSel ? orderSel.value : 'DESC';
			var category = catSel   ? catSel.value   : '0';

			var data = new FormData();
			data.append( 'action',       'gpa_filter' );
			data.append( 'nonce',        gpaAjax.nonce );
			data.append( 'postType',     postType );
			data.append( 'postsPerPage', postsPerPage );
			data.append( 'order',        order );
			data.append( 'categoryId',   category );
			data.append( 'paged',        page );

			grid.style.opacity = '0.5';

			fetch( gpaAjax.ajaxUrl, { method: 'POST', body: data } )
				.then( function ( r ) { return r.json(); } )
				.then( function ( res ) {
					if ( ! res.success ) return;
					grid.innerHTML    = res.data.html;
					grid.style.opacity = '1';
					currentPage       = res.data.currentPage;
					updatePagination( res.data.totalPages, currentPage );
					archive.scrollIntoView( { behavior: 'smooth', block: 'start' } );
				} )
				.catch( function () {
					grid.style.opacity = '1';
				} );
		}

		function updatePagination( totalPages, activePage ) {
			if ( ! pagination ) return;

			pagination.dataset.totalPages   = totalPages;
			pagination.dataset.currentPage  = activePage;

			var prev     = pagination.querySelector( '.gpa-prev' );
			var next     = pagination.querySelector( '.gpa-next' );
			var numWrap  = pagination.querySelector( '.gpa-page-numbers' );

			if ( prev ) prev.disabled = ( activePage <= 1 );
			if ( next ) next.disabled = ( activePage >= totalPages );

			if ( numWrap ) {
				numWrap.innerHTML = '';
				for ( var i = 1; i <= totalPages; i++ ) {
					var btn = document.createElement( 'button' );
					btn.className  = 'gpa-page-num' + ( i === activePage ? ' active' : '' );
					btn.dataset.page = i;
					btn.textContent  = i;
					btn.addEventListener( 'click', onPageClick );
					numWrap.appendChild( btn );
				}
			}
		}

		function onPageClick( e ) {
			var page = parseInt( e.currentTarget.dataset.page, 10 );
			if ( page && page !== currentPage ) {
				fetchPosts( page );
			}
		}

		/* Filter button */
		if ( filterBtn ) {
			filterBtn.addEventListener( 'click', function () {
				currentPage = 1;
				fetchPosts( 1 );
			} );
		}

		/* Prev / Next */
		if ( pagination ) {
			var prev = pagination.querySelector( '.gpa-prev' );
			var next = pagination.querySelector( '.gpa-next' );

			if ( prev ) {
				prev.addEventListener( 'click', function () {
					if ( currentPage > 1 ) fetchPosts( currentPage - 1 );
				} );
			}
			if ( next ) {
				next.addEventListener( 'click', function () {
					var total = parseInt( pagination.dataset.totalPages, 10 );
					if ( currentPage < total ) fetchPosts( currentPage + 1 );
				} );
			}

			/* Initial page number buttons */
			pagination.querySelectorAll( '.gpa-page-num' ).forEach( function ( btn ) {
				btn.addEventListener( 'click', onPageClick );
			} );
		}
	}

} )();
