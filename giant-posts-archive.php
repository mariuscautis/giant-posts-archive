<?php
/**
 * Plugin Name: Giant Posts Archive
 * Plugin URI:  https://www.gogiant.co.uk
 * Description: A Gutenberg block that renders a paginated posts archive with date/category filtering.
 * Version:     1.0.0
 * Author:      Marius C.
 * Author URI:  https://www.gogiant.co.uk
 * License:     GPL-2.0-or-later
 * Text Domain: giant-posts-archive
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* ─────────────────────────────────────────────
 * Register assets + block type
 * ───────────────────────────────────────────── */
function giant_posts_archive_register(): void {

	$ver = '1.0.0';

	wp_register_script(
		'giant-posts-archive-editor',
		plugins_url( 'build/index.js', __FILE__ ),
		[ 'wp-blocks', 'wp-block-editor', 'wp-components', 'wp-i18n', 'wp-element', 'wp-api-fetch', 'wp-data' ],
		$ver,
		false
	);

	wp_register_style(
		'giant-posts-archive-style',
		plugins_url( 'build/style.css', __FILE__ ),
		[],
		$ver
	);

	register_block_type( 'giant-posts-archive/posts-archive', [
		'api_version'     => 3,
		'title'           => __( 'Giant Posts Archive', 'giant-posts-archive' ),
		'category'        => 'widgets',
		'icon'            => 'archive',
		'attributes'      => [
			'postType'       => [ 'type' => 'string',  'default' => 'post' ],
			'postsPerPage'   => [ 'type' => 'integer', 'default' => 6 ],
			'heading'        => [ 'type' => 'string',  'default' => '' ],
			'className'      => [ 'type' => 'string',  'default' => '' ],
			'accentColor'    => [ 'type' => 'string',  'default' => '' ],
			'cardBgColor'    => [ 'type' => 'string',  'default' => '' ],
			'filterBtnColor' => [ 'type' => 'string',  'default' => '' ],
		],
		'editor_script'   => 'giant-posts-archive-editor',
		'style'           => 'giant-posts-archive-style',
		'render_callback' => 'giant_posts_archive_render',
	] );
}
add_action( 'init', 'giant_posts_archive_register' );

/* ─────────────────────────────────────────────
 * REST endpoint: returns available post types
 * ───────────────────────────────────────────── */
function giant_posts_archive_rest_post_types(): void {
	register_rest_route( 'giant-posts-archive/v1', '/post-types', [
		'methods'             => 'GET',
		'callback'            => function () {
			$post_types = get_post_types( [ 'public' => true ], 'objects' );
			$options    = [];
			foreach ( $post_types as $slug => $obj ) {
				if ( 'attachment' === $slug ) {
					continue;
				}
				$options[] = [
					'value' => $slug,
					'label' => $obj->labels->singular_name . ' (' . $slug . ')',
				];
			}
			return rest_ensure_response( $options );
		},
		'permission_callback' => function () {
			return current_user_can( 'edit_posts' );
		},
	] );
}
add_action( 'rest_api_init', 'giant_posts_archive_rest_post_types' );

/* ─────────────────────────────────────────────
 * Enqueue frontend JS (handles filter + pagination via AJAX)
 * ───────────────────────────────────────────── */
function giant_posts_archive_frontend_scripts(): void {
	if ( ! has_block( 'giant-posts-archive/posts-archive' ) ) {
		return;
	}
	wp_enqueue_script(
		'giant-posts-archive-frontend',
		plugins_url( 'build/frontend.js', __FILE__ ),
		[],
		'1.0.0',
		true
	);
	wp_localize_script( 'giant-posts-archive-frontend', 'gpaAjax', [
		'ajaxUrl' => admin_url( 'admin-ajax.php' ),
		'nonce'   => wp_create_nonce( 'gpa_filter_nonce' ),
	] );
}
add_action( 'wp_enqueue_scripts', 'giant_posts_archive_frontend_scripts' );

/* ─────────────────────────────────────────────
 * AJAX handler for filter + pagination
 * ───────────────────────────────────────────── */
function giant_posts_archive_ajax(): void {
	check_ajax_referer( 'gpa_filter_nonce', 'nonce' );

	$post_type     = sanitize_key( $_POST['postType']     ?? 'post' );
	$posts_per_page = absint( $_POST['postsPerPage'] ?? 6 );
	$order_by      = sanitize_key( $_POST['orderBy']      ?? 'date' );
	$order         = strtoupper( sanitize_key( $_POST['order'] ?? 'DESC' ) );
	$category_id   = absint( $_POST['categoryId']  ?? 0 );
	$paged         = absint( $_POST['paged']        ?? 1 );

	if ( ! in_array( $order, [ 'ASC', 'DESC' ], true ) ) {
		$order = 'DESC';
	}

	$args = [
		'post_type'      => $post_type,
		'posts_per_page' => $posts_per_page,
		'orderby'        => 'date',
		'order'          => $order,
		'paged'          => $paged,
	];

	if ( $category_id > 0 ) {
		$args['cat'] = $category_id;
	}

	$query = new WP_Query( $args );

	$logo_url = '';
	$logo_id  = get_theme_mod( 'custom_logo' );
	if ( $logo_id ) {
		$logo_src = wp_get_attachment_image_src( $logo_id, 'full' );
		$logo_url = $logo_src ? $logo_src[0] : '';
	}

	$total_pages = $query->max_num_pages;

	ob_start();

	if ( $query->have_posts() ) :
		while ( $query->have_posts() ) :
			$query->the_post();
			$post_id    = get_the_ID();
			$blog_image = get_the_post_thumbnail_url( $post_id, 'large' );
			$permalink  = get_permalink( $post_id );
			$img_pos    = get_field( 'featured_image_position', $post_id ) ?: 'center';
			$content    = get_the_content();
			$excerpt    = wp_strip_all_tags( wp_trim_words( $content, 10, '...' ) );
			$has_image  = ! empty( $blog_image );
			?>
			<div class="blog-item">
				<div class="blog-inner">
					<?php if ( $has_image ) : ?>
					<div
						class="blog-featured-image"
						style="background-image: url(<?php echo esc_url( $blog_image ); ?>); background-position: <?php echo esc_attr( $img_pos ); ?>"
					></div>
					<?php else : ?>
					<div class="blog-featured-image blog-featured-image--placeholder">
						<?php if ( $logo_url ) : ?>
							<img src="<?php echo esc_url( $logo_url ); ?>" alt="<?php echo esc_attr( get_bloginfo( 'name' ) ); ?>">
						<?php else : ?>
							<span class="blog-placeholder-text"><?php echo esc_html( get_bloginfo( 'name' ) ); ?></span>
						<?php endif; ?>
					</div>
					<?php endif; ?>
					<div class="blog-details">
						<div class="blog-date">
							<?php echo esc_html( get_the_date( 'd/m/y' ) ); ?>
							<div class="calendar-icon"></div>
						</div>
						<h4 class="blog-title"><?php the_title(); ?></h4>
						<div class="excerpt"><?php echo esc_html( $excerpt ); ?></div>
						<a href="<?php echo esc_url( $permalink ); ?>" class="btn blog-btn">Read more</a>
					</div>
				</div>
			</div>
			<?php
		endwhile;
		wp_reset_postdata();
	else :
		echo '<p class="gpa-no-posts">' . esc_html__( 'No posts found.', 'giant-posts-archive' ) . '</p>';
	endif;

	$html = ob_get_clean();

	wp_send_json_success( [
		'html'        => $html,
		'totalPages'  => (int) $total_pages,
		'currentPage' => $paged,
	] );
}
add_action( 'wp_ajax_gpa_filter',        'giant_posts_archive_ajax' );
add_action( 'wp_ajax_nopriv_gpa_filter', 'giant_posts_archive_ajax' );

/* ─────────────────────────────────────────────
 * Server-side render callback (initial load)
 * ───────────────────────────────────────────── */
function giant_posts_archive_render( array $attrs ): string {

	$post_type      = sanitize_key( $attrs['postType']     ?? 'post' );
	$posts_per_page = absint( $attrs['postsPerPage'] ?? 6 );
	$heading        = sanitize_text_field( $attrs['heading'] ?? '' );
	$extra_class    = implode( ' ', array_map( 'sanitize_html_class', explode( ' ', trim( $attrs['className'] ?? '' ) ) ) );

	$accent_color     = sanitize_hex_color( $attrs['accentColor']    ?? '' ) ?: '';
	$card_bg_color    = sanitize_hex_color( $attrs['cardBgColor']    ?? '' ) ?: '';
	$filter_btn_color = sanitize_hex_color( $attrs['filterBtnColor'] ?? '' ) ?: '';

	// Generate a unique scope ID for this block instance so styles don't bleed
	$scope_id  = 'gpa-' . substr( md5( serialize( $attrs ) . uniqid() ), 0, 8 );
	$inline_css = '';
	if ( $accent_color ) {
		$inline_css .= '#' . $scope_id . ' .blog-date,'
			. '#' . $scope_id . ' .blog-btn,'
			. '#' . $scope_id . ' .gpa-select,'
			. '#' . $scope_id . ' .gpa-page-btn,'
			. '#' . $scope_id . ' .gpa-page-num { color:' . esc_attr( $accent_color ) . '; border-color:' . esc_attr( $accent_color ) . '; }'
			. '#' . $scope_id . ' .gpa-select { border-bottom-color:' . esc_attr( $accent_color ) . '; }'
			. '#' . $scope_id . ' .gpa-page-num.active { background:' . esc_attr( $accent_color ) . '; color:#fff; }';
	}
	if ( $card_bg_color ) {
		$inline_css .= '#' . $scope_id . ' .blog-inner { background-color:' . esc_attr( $card_bg_color ) . '; }';
	}
	if ( $filter_btn_color ) {
		$inline_css .= '#' . $scope_id . ' .gpa-filter-btn { background-color:' . esc_attr( $filter_btn_color ) . '; }';
	}

	// Categories for the filter dropdown (only applicable to 'post' type natively)
	$categories = get_categories( [ 'hide_empty' => true ] );

	$query = new WP_Query( [
		'post_type'      => $post_type,
		'posts_per_page' => $posts_per_page,
		'orderby'        => 'date',
		'order'          => 'DESC',
		'paged'          => 1,
	] );

	$total_pages = $query->max_num_pages;

	$logo_url = '';
	$logo_id  = get_theme_mod( 'custom_logo' );
	if ( $logo_id ) {
		$logo_src = wp_get_attachment_image_src( $logo_id, 'full' );
		$logo_url = $logo_src ? $logo_src[0] : '';
	}

	ob_start();
	?>
	<?php if ( $inline_css ) : ?>
	<style><?php echo $inline_css; ?></style>
	<?php endif; ?>
	<section
		id="<?php echo esc_attr( $scope_id ); ?>"
		class="posts-archive<?php echo $extra_class ? ' ' . esc_attr( $extra_class ) : ''; ?>"
		data-post-type="<?php echo esc_attr( $post_type ); ?>"
		data-posts-per-page="<?php echo esc_attr( $posts_per_page ); ?>"
	>
		<div class="container">
			<?php if ( $heading ) : ?>
				<h3 class="loop-heading"><?php echo esc_html( $heading ); ?></h3>
			<?php endif; ?>

			<!-- Filter bar -->
			<div class="gpa-filter-bar">
				<div class="gpa-filter-group">
					<label class="gpa-filter-label"><?php esc_html_e( 'Order by date:', 'giant-posts-archive' ); ?></label>
					<div class="gpa-select-wrap">
						<select class="gpa-select" id="gpa-order">
							<option value="DESC"><?php esc_html_e( 'Newest first', 'giant-posts-archive' ); ?></option>
							<option value="ASC"><?php esc_html_e( 'Oldest first', 'giant-posts-archive' ); ?></option>
						</select>
					</div>
				</div>

				<?php if ( ! empty( $categories ) ) : ?>
				<div class="gpa-filter-group">
					<label class="gpa-filter-label"><?php esc_html_e( 'Category:', 'giant-posts-archive' ); ?></label>
					<div class="gpa-select-wrap">
						<select class="gpa-select" id="gpa-category">
							<option value="0"><?php esc_html_e( 'All categories', 'giant-posts-archive' ); ?></option>
							<?php foreach ( $categories as $cat ) : ?>
								<option value="<?php echo esc_attr( $cat->term_id ); ?>">
									<?php echo esc_html( $cat->name ); ?>
								</option>
							<?php endforeach; ?>
						</select>
					</div>
				</div>
				<?php endif; ?>

				<button class="gpa-filter-btn" id="gpa-filter-trigger">
					<?php esc_html_e( 'Filter', 'giant-posts-archive' ); ?>
				</button>
			</div>

			<!-- Posts grid -->
			<div class="loop-content gpa-posts-grid">
				<?php
				if ( $query->have_posts() ) :
					while ( $query->have_posts() ) :
						$query->the_post();
						$post_id    = get_the_ID();
						$blog_image = get_the_post_thumbnail_url( $post_id, 'large' );
						$permalink  = get_permalink( $post_id );
						$img_pos    = get_field( 'featured_image_position', $post_id ) ?: 'center';
						$content    = get_the_content();
						$excerpt    = wp_strip_all_tags( wp_trim_words( $content, 10, '...' ) );
						$has_image  = ! empty( $blog_image );
						?>
						<div class="blog-item">
							<div class="blog-inner">
								<?php if ( $has_image ) : ?>
								<div
									class="blog-featured-image"
									style="background-image: url(<?php echo esc_url( $blog_image ); ?>); background-position: <?php echo esc_attr( $img_pos ); ?>"
								></div>
								<?php else : ?>
								<div class="blog-featured-image blog-featured-image--placeholder">
									<?php if ( $logo_url ) : ?>
										<img src="<?php echo esc_url( $logo_url ); ?>" alt="<?php echo esc_attr( get_bloginfo( 'name' ) ); ?>">
									<?php else : ?>
										<span class="blog-placeholder-text"><?php echo esc_html( get_bloginfo( 'name' ) ); ?></span>
									<?php endif; ?>
								</div>
								<?php endif; ?>
								<div class="blog-details">
									<div class="blog-date">
										<?php echo esc_html( get_the_date( 'd/m/y' ) ); ?>
										<div class="calendar-icon"></div>
									</div>
									<h4 class="blog-title"><?php the_title(); ?></h4>
									<div class="excerpt"><?php echo esc_html( $excerpt ); ?></div>
									<a href="<?php echo esc_url( $permalink ); ?>" class="btn blog-btn">Read more</a>
								</div>
							</div>
						</div>
						<?php
					endwhile;
					wp_reset_postdata();
				else :
					echo '<p class="gpa-no-posts">' . esc_html__( 'No posts found.', 'giant-posts-archive' ) . '</p>';
				endif;
				?>
			</div>

			<!-- Pagination -->
			<?php if ( $total_pages > 1 ) : ?>
			<nav class="gpa-pagination" data-total-pages="<?php echo esc_attr( $total_pages ); ?>" data-current-page="1">
				<button class="gpa-page-btn gpa-prev" disabled aria-label="Previous page">&lsaquo;</button>
				<div class="gpa-page-numbers">
					<?php for ( $i = 1; $i <= $total_pages; $i++ ) : ?>
						<button
							class="gpa-page-num<?php echo $i === 1 ? ' active' : ''; ?>"
							data-page="<?php echo esc_attr( $i ); ?>"
						><?php echo esc_html( $i ); ?></button>
					<?php endfor; ?>
				</div>
				<button class="gpa-page-btn gpa-next" <?php echo $total_pages <= 1 ? 'disabled' : ''; ?> aria-label="Next page">&rsaquo;</button>
			</nav>
			<?php endif; ?>
		</div>
	</section>
	<?php
	return ob_get_clean();
}
