<?php
/**
 * Admin UI: dashboard with health checks + settings form.
 *
 * @package AgentReadyShop
 */

defined( 'ABSPATH' ) || exit;

class AFS_Admin {

	const CHECK_TRANSIENT = 'afs_health_checks';

	/**
	 * Register hooks.
	 */
	public function hooks() {
		add_action( 'admin_menu', array( $this, 'menu' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'admin_init', array( $this, 'handle_license' ) );
		add_action( 'admin_post_afs_export_csv', array( $this, 'export_csv' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( AFS_FILE ), array( $this, 'action_links' ) );
	}

	/**
	 * Handle license activate/deactivate submissions.
	 */
	public function handle_license() {
		if ( ! isset( $_POST['afs_license_action'] ) || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		check_admin_referer( 'afs_license' );

		$action = sanitize_key( wp_unslash( $_POST['afs_license_action'] ) );
		if ( 'activate' === $action ) {
			$key = sanitize_text_field( wp_unslash( $_POST['afs_license_key'] ?? '' ) );
			update_option( AFS_License::OPTION_KEY, $key, false );
		} elseif ( 'deactivate' === $action ) {
			delete_option( AFS_License::OPTION_KEY );
		}
		AFS_License::flush();
		delete_transient( self::CHECK_TRANSIENT );

		wp_safe_redirect( admin_url( 'admin.php?page=agent-ready-shop&afs_license=updated' ) );
		exit;
	}

	/**
	 * Add the top-level admin menu.
	 */
	public function menu() {
		add_menu_page(
			__( 'Agent Ready Shop', 'agent-ready-shop' ),
			__( 'Agent Shop', 'agent-ready-shop' ),
			'manage_options',
			'agent-ready-shop',
			array( $this, 'render' ),
			'dashicons-rest-api',
			58
		);
	}

	/**
	 * Register the settings group.
	 */
	public function register_settings() {
		register_setting(
			'afs_settings_group',
			AFS_Settings::OPTION,
			array( 'sanitize_callback' => array( 'AFS_Settings', 'sanitize' ) )
		);
	}

	/**
	 * Add a Settings link on the plugins list.
	 *
	 * @param string[] $links Existing links.
	 * @return string[]
	 */
	public function action_links( $links ) {
		$url = admin_url( 'admin.php?page=agent-ready-shop' );
		array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'agent-ready-shop' ) . '</a>' );
		return $links;
	}

	/**
	 * Run (and cache) the health checks.
	 *
	 * @param bool $force Bypass cache.
	 * @return array[]
	 */
	private function health( $force = false ) {
		if ( ! $force ) {
			$cached = get_transient( self::CHECK_TRANSIENT );
			if ( is_array( $cached ) ) {
				return $cached;
			}
		}

		$checks = array();
		$has_wc = class_exists( 'WooCommerce' );

		$checks[] = array(
			'label'  => __( 'WooCommerce active', 'agent-ready-shop' ),
			'status' => $has_wc ? 'ok' : 'fail',
			'note'   => $has_wc ? __( 'Detected.', 'agent-ready-shop' ) : __( 'Not found — product data will be empty.', 'agent-ready-shop' ),
		);

		if ( $has_wc && function_exists( 'wc_get_products' ) ) {
			$count    = wp_count_posts( 'product' );
			$published = isset( $count->publish ) ? (int) $count->publish : 0;
			$checks[]  = array(
				'label'  => __( 'Published products', 'agent-ready-shop' ),
				'status' => $published > 0 ? 'ok' : 'warn',
				'note'   => sprintf( _n( '%d product exposed.', '%d products exposed.', $published, 'agent-ready-shop' ), $published ),
			);
		}

		list( $llms_ok, $llms_note ) = $this->url_ok( home_url( '/llms.txt' ) );
		$checks[] = array(
			'label'  => 'llms.txt',
			'status' => $llms_ok ? 'ok' : 'warn',
			'note'   => $llms_ok ? __( 'Reachable.', 'agent-ready-shop' ) : $llms_note,
		);

		list( $man_ok, $man_note ) = $this->url_ok( home_url( '/.well-known/agent-shop.json' ) );
		$checks[] = array(
			'label'  => '/.well-known/agent-shop.json',
			'status' => $man_ok ? 'ok' : 'warn',
			'note'   => $man_ok ? __( 'Reachable.', 'agent-ready-shop' ) : __( 'Not reachable — server may intercept /.well-known/.', 'agent-ready-shop' ),
		);

		list( $api_ok, $api_note ) = $this->url_ok( rest_url( AFS_REST_NAMESPACE . '/products' ) );
		$checks[] = array(
			'label'  => __( 'REST product feed', 'agent-ready-shop' ),
			'status' => $api_ok ? 'ok' : 'fail',
			'note'   => $api_ok ? __( 'Responding.', 'agent-ready-shop' ) : $api_note,
		);

		// Physical robots.txt overrides the filter.
		$robots_file = ABSPATH . 'robots.txt';
		if ( file_exists( $robots_file ) ) {
			$checks[] = array(
				'label'  => __( 'robots.txt hints', 'agent-ready-shop' ),
				'status' => 'warn',
				'note'   => __( 'A physical robots.txt exists; add the AI-agent rules to it manually.', 'agent-ready-shop' ),
			);
		}

		// Duplicate-schema warning.
		$conflicts = array();
		if ( defined( 'WPSEO_VERSION' ) ) {
			$conflicts[] = 'Yoast SEO';
		}
		if ( class_exists( 'RankMath' ) ) {
			$conflicts[] = 'Rank Math';
		}
		if ( $conflicts && ! AFS_Settings::get( 'disable_wc_schema' ) ) {
			$checks[] = array(
				'label'  => __( 'Structured data conflicts', 'agent-ready-shop' ),
				'status' => 'warn',
				'note'   => sprintf( __( '%s also emits Product schema. Disable duplicates below or in that plugin.', 'agent-ready-shop' ), implode( ', ', $conflicts ) ),
			);
		}

		set_transient( self::CHECK_TRANSIENT, $checks, 5 * MINUTE_IN_SECONDS );
		return $checks;
	}

	/**
	 * Loopback GET a URL, returning [bool ok, string note].
	 *
	 * @param string $url URL.
	 * @return array{0:bool,1:string}
	 */
	private function url_ok( $url ) {
		$res = wp_remote_get( $url, array(
			'timeout'     => 5,
			'redirection' => 2,
			'sslverify'   => false,
			'headers'     => array( 'User-Agent' => 'AgentFriendlyShop-HealthCheck/' . AFS_VERSION ),
		) );
		if ( is_wp_error( $res ) ) {
			return array( false, $res->get_error_message() );
		}
		$code = (int) wp_remote_retrieve_response_code( $res );
		return array( $code >= 200 && $code < 400, 'HTTP ' . $code );
	}

	/**
	 * A small "Pro" badge, dimmed when the feature is locked.
	 *
	 * @param string $feature Feature code.
	 * @return string
	 */
	private function pro_badge( $feature ) {
		$on  = AFS_License::can( $feature );
		$bg  = $on ? '#008a20' : '#8c8f94';
		$txt = $on ? __( 'Pro', 'agent-ready-shop' ) : __( 'Pro (locked)', 'agent-ready-shop' );
		return '<span style="display:inline-block;font-size:10px;font-weight:600;text-transform:uppercase;color:#fff;background:' . $bg . ';border-radius:3px;padding:1px 6px;margin-left:6px;vertical-align:1px">' . esc_html( $txt ) . '</span>';
	}

	/**
	 * Render the licensing panel.
	 */
	private function render_license_panel() {
		$is_pro = AFS_License::is_pro();
		$data   = AFS_License::data();
		$key    = AFS_License::key();

		echo '<div style="border:1px solid ' . ( $is_pro ? '#008a20' : '#c3c4c7' ) . ';border-left-width:4px;background:#fff;padding:12px 16px;margin:16px 0;max-width:820px;border-radius:4px">';

		echo '<h2 style="margin-top:0"><span class="dashicons dashicons-' . ( $is_pro ? 'yes-alt' : 'lock' ) . '" style="vertical-align:-3px;color:' . ( $is_pro ? '#008a20' : '#8c8f94' ) . '"></span> ' . esc_html__( 'License', 'agent-ready-shop' ) . '</h2>';

		if ( $is_pro ) {
			$expires = ( ! empty( $data['exp'] ) ) ? date_i18n( get_option( 'date_format' ), $data['exp'] ) : __( 'Never (perpetual)', 'agent-ready-shop' );
			echo '<p style="margin:.2em 0"><strong style="color:#008a20">' . esc_html__( 'Pro license active.', 'agent-ready-shop' ) . '</strong> ';
			printf(
				/* translators: 1: plan, 2: serial, 3: expiry */
				esc_html__( 'Plan: %1$s · Serial: %2$s · Expires: %3$s', 'agent-ready-shop' ),
				'<code>' . esc_html( $data['plan'] ) . '</code>',
				'<code>' . esc_html( $data['serial'] ) . '</code>',
				esc_html( $expires )
			);
			if ( ! empty( $data['domain'] ) && '*' !== $data['domain'] ) {
				/* translators: %s: licensed domain */
				echo ' &middot; ' . sprintf( esc_html__( 'Licensed for: %s', 'agent-ready-shop' ), '<code>' . esc_html( $data['domain'] ) . '</code>' );
			}
			echo '</p>';

			echo '<p style="margin:.4em 0"><em>' . esc_html__( 'Unlocked features:', 'agent-ready-shop' ) . '</em></p><ul style="margin:.2em 0 .6em 1.4em">';
			foreach ( AFS_License::FEATURES as $code => $label ) {
				$on = AFS_License::can( $code );
				echo '<li style="list-style:disc"><span class="dashicons dashicons-' . ( $on ? 'yes' : 'minus' ) . '" style="color:' . ( $on ? '#008a20' : '#a7aaad' ) . ';vertical-align:-3px"></span> ' . esc_html( $label ) . '</li>';
			}
			echo '</ul>';

			echo '<form method="post">';
			wp_nonce_field( 'afs_license' );
			echo '<input type="hidden" name="afs_license_action" value="deactivate">';
			submit_button( __( 'Deactivate license', 'agent-ready-shop' ), 'secondary', 'submit', false );
			echo '</form>';

			// Certificate + embeddable trust badge.
			$embed = AFS_Certificate::embed_html( 'dark' );
			echo '<div style="margin-top:16px;padding-top:14px;border-top:1px solid #e0e0e0">';
			echo '<h3 style="margin:.2em 0">' . esc_html__( 'Your Agent Ready certificate', 'agent-ready-shop' ) . '</h3>';
			printf(
				'<p style="margin:.2em 0">%s <code>%s</code> &middot; <a href="%s" target="_blank" rel="noopener">%s</a></p>',
				esc_html__( 'Reference ID:', 'agent-ready-shop' ),
				esc_html( AFS_Certificate::cert_id() ),
				esc_url( AFS_Certificate::verify_url() ),
				esc_html__( 'View public verification', 'agent-ready-shop' )
			);
			echo '<p class="description" style="margin:.2em 0">' . esc_html__( 'The badge shows the score from the live audit the Agent Ready Shop service runs against your public site (refreshed daily). It cannot be set from here.', 'agent-ready-shop' ) . '</p>';
			echo '<p style="margin:.6em 0 .2em"><strong>' . esc_html__( 'Preview:', 'agent-ready-shop' ) . '</strong></p>';
			echo '<p>' . $embed . '</p>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built with esc_url internally.
			echo '<p style="margin:.6em 0 .2em"><strong>' . esc_html__( 'Embed code (paste anywhere):', 'agent-ready-shop' ) . '</strong></p>';
			echo '<textarea readonly class="large-text code" rows="3" onclick="this.select()" style="max-width:640px">' . esc_textarea( $embed ) . '</textarea>';
			echo '<p class="description">' . esc_html__( 'Or use the shortcode:', 'agent-ready-shop' ) . ' <code>[agent_ready_badge]</code></p>';
			echo '</div>';
		} else {
			if ( '' !== $key && ! empty( $data['error'] ) ) {
				echo '<div class="notice notice-error inline" style="margin:.5em 0"><p>' . esc_html( $data['error'] ) . '</p></div>';
			}
			echo '<p class="description">' . esc_html__( 'Running the free edition. Enter a license key to unlock premium features (auto-updates, unlimited agents + wildcard, full XML feed, custom llms.txt, larger feeds).', 'agent-ready-shop' ) . '</p>';
			echo '<form method="post" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
			wp_nonce_field( 'afs_license' );
			echo '<input type="hidden" name="afs_license_action" value="activate">';
			echo '<input type="text" name="afs_license_key" value="' . esc_attr( $key ) . '" placeholder="XXXXX-XXXXX-XXXXX-…" class="regular-text code" style="min-width:360px;font-family:monospace">';
			submit_button( __( 'Activate', 'agent-ready-shop' ), 'primary', 'submit', false );
			echo '</form>';
		}

		echo '</div>';
	}

	/**
	 * Render the AIO score + AI traffic dashboard.
	 */
	private function render_dashboard() {
		$score = AFS_Score::value();
		$tier  = AFS_Score::tier( $score );
		$color = ( 'gold' === $tier ) ? '#0a7d28' : ( ( 'blue' === $tier ) ? '#2271b1' : '#996800' );
		$sum   = AFS_Analytics::summary();

		echo '<div style="display:flex;gap:16px;flex-wrap:wrap;margin:16px 0;max-width:820px">';

		// Score card.
		echo '<div style="flex:1;min-width:300px;background:#fff;border:1px solid #c3c4c7;border-radius:4px;padding:16px 18px">';
		echo '<h2 style="margin:0 0 4px">' . esc_html__( 'Setup score', 'agent-ready-shop' ) . '</h2>';
		echo '<p class="description" style="margin:0 0 10px">' . esc_html__( 'How much of the agent layer is switched on in this plugin. Your public AIO score is measured separately by a live audit:', 'agent-ready-shop' ) . ' <a href="' . esc_url( AFS_Certificate::verify_url() ) . '" target="_blank" rel="noopener">' . esc_html__( 'run it now', 'agent-ready-shop' ) . '</a>.</p>';
		echo '<div style="display:flex;align-items:center;gap:16px">';
		echo '<div style="width:88px;height:88px;border-radius:50%;border:6px solid ' . esc_attr( $color ) . ';display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0">';
		echo '<span style="font-size:28px;font-weight:700;color:' . esc_attr( $color ) . '">' . (int) $score . '</span>';
		echo '<span style="font-size:9px;color:#8c8f94;letter-spacing:.05em">/ 100</span></div>';
		echo '<ul style="margin:0;flex:1">';
		foreach ( AFS_Score::breakdown() as $row ) {
			$on = $row[0] >= $row[1];
			echo '<li style="list-style:none;display:flex;justify-content:space-between;padding:2px 0">';
			echo '<span><span class="dashicons dashicons-' . ( $on ? 'yes' : 'minus' ) . '" style="color:' . ( $on ? '#008a20' : '#a7aaad' ) . ';vertical-align:-3px"></span> ' . esc_html( $row[2] ) . '</span>';
			echo '<span style="color:#50575e">' . (int) $row[0] . '/' . (int) $row[1] . '</span></li>';
		}
		echo '</ul></div></div>';

		// AI traffic card.
		echo '<div style="flex:1;min-width:300px;background:#fff;border:1px solid #c3c4c7;border-radius:4px;padding:16px 18px">';
		echo '<h2 style="margin:0 0 10px">' . esc_html__( 'AI traffic (last 30 days)', 'agent-ready-shop' ) . '</h2>';
		if ( $sum['total'] <= 0 ) {
			echo '<p class="description">' . esc_html__( 'No AI-agent visits recorded yet. Data appears here as GPTBot, ClaudeBot, PerplexityBot and AI referrals reach your store.', 'agent-ready-shop' ) . '</p>';
		} else {
			echo '<p style="margin:.2em 0"><span style="font-size:26px;font-weight:700;color:#1d2327">' . number_format_i18n( $sum['total'] ) . '</span> <span style="color:#50575e">' . esc_html__( 'AI hits', 'agent-ready-shop' ) . '</span>';
			if ( $sum['verified'] || $sum['spoofed'] ) {
				echo ' &middot; <span style="color:#007017">' . number_format_i18n( $sum['verified'] ) . ' ' . esc_html__( 'verified', 'agent-ready-shop' ) . '</span>';
				if ( $sum['spoofed'] ) {
					echo ' &middot; <span style="color:#b32d2e">' . number_format_i18n( $sum['spoofed'] ) . ' ' . esc_html__( 'spoofed', 'agent-ready-shop' ) . '</span>';
				}
			}
			echo '</p>';
			$agents = array_slice( $sum['agents'], 0, 5, true );
			echo '<table style="width:100%;border-collapse:collapse;margin-top:6px">';
			foreach ( $agents as $label => $n ) {
				echo '<tr><td style="padding:3px 0;font-family:monospace;color:#1d2327">' . esc_html( $label ) . '</td>';
				echo '<td style="padding:3px 0;text-align:right"><span style="background:#edfaef;color:#007017;padding:1px 8px;border-radius:3px;font-weight:600">' . number_format_i18n( $n ) . '</span></td></tr>';
			}
			echo '</table>';

			// Pages agents read / pages AI cites.
			$this->mini_list( __( 'Top pages read by agents', 'agent-ready-shop' ), array_slice( $sum['pages'], 0, 4, true ) );
			$this->mini_list( __( 'Pages cited by AI assistants', 'agent-ready-shop' ), array_slice( $sum['cited'], 0, 4, true ) );

			if ( ! empty( $sum['referrals'] ) ) {
				echo '<p style="margin:.8em 0 .2em;color:#50575e">' . esc_html__( 'Referrals from AI assistants:', 'agent-ready-shop' ) . '</p>';
				$parts = array();
				foreach ( array_slice( $sum['referrals'], 0, 4, true ) as $label => $n ) {
					$parts[] = esc_html( $label ) . ' (' . number_format_i18n( $n ) . ')';
				}
				echo '<p style="margin:0 0 .6em">' . implode( ' &middot; ', $parts ) . '</p>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- parts escaped above.
			}

			// CSV export (Pro).
			if ( AFS_License::can( 'an' ) ) {
				$url = wp_nonce_url( admin_url( 'admin-post.php?action=afs_export_csv' ), 'afs_export' );
				echo '<a class="button button-secondary" href="' . esc_url( $url ) . '">' . esc_html__( 'Export CSV', 'agent-ready-shop' ) . '</a>';
			} else {
				echo '<span class="description">' . esc_html__( 'CSV export is a Pro feature.', 'agent-ready-shop' ) . '</span>';
			}
		}
		echo '</div></div>';
	}

	/**
	 * Render a small "label → count" list (paths).
	 *
	 * @param string $title Heading.
	 * @param array  $rows  path => count.
	 */
	private function mini_list( $title, $rows ) {
		if ( empty( $rows ) ) {
			return;
		}
		echo '<p style="margin:.8em 0 .2em;color:#50575e">' . esc_html( $title ) . ':</p>';
		echo '<table style="width:100%;border-collapse:collapse">';
		foreach ( $rows as $path => $n ) {
			echo '<tr><td style="padding:2px 0;font-family:monospace;color:#2271b1;font-size:12px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' . esc_html( $path ) . '</td>';
			echo '<td style="padding:2px 0;text-align:right;color:#50575e">' . number_format_i18n( $n ) . '</td></tr>';
		}
		echo '</table>';
	}

	/**
	 * Stream the analytics CSV (Pro).
	 */
	public function export_csv() {
		if ( ! current_user_can( 'manage_options' ) || ! check_admin_referer( 'afs_export' ) || ! AFS_License::can( 'an' ) ) {
			wp_die( esc_html__( 'Not allowed.', 'agent-ready-shop' ) );
		}
		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="agent-ready-analytics.csv"' );
		echo AFS_Analytics::export_csv(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CSV text.
		exit;
	}

	/**
	 * Render the admin page.
	 */
	public function render() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$force = isset( $_GET['afs_recheck'] ) && check_admin_referer( 'afs_recheck' );
		if ( $force ) {
			delete_transient( self::CHECK_TRANSIENT );
		}
		$checks   = $this->health( $force );
		$settings = AFS_Settings::all();
		$ns       = AFS_REST_NAMESPACE;

		$colors = array( 'ok' => '#008a20', 'warn' => '#996800', 'fail' => '#b32d2e' );
		$icons  = array( 'ok' => 'yes-alt', 'warn' => 'warning', 'fail' => 'dismiss' );
		?>
		<div class="wrap afs-wrap">
			<h1><span class="dashicons dashicons-rest-api" style="font-size:28px;height:28px;width:28px;vertical-align:-4px"></span> <?php esc_html_e( 'Agent Ready Shop', 'agent-ready-shop' ); ?></h1>
			<p class="description"><?php esc_html_e( 'Surfaces your catalog to AI shopping agents via structured data, a clean API, and discovery files.', 'agent-ready-shop' ); ?></p>

			<?php $this->render_dashboard(); ?>

			<?php $this->render_license_panel(); ?>

			<h2 style="margin-top:1.5em"><?php esc_html_e( 'Health checks', 'agent-ready-shop' ); ?>
				<a class="button button-secondary" style="margin-left:8px" href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin.php?page=agent-ready-shop&afs_recheck=1' ), 'afs_recheck' ) ); ?>"><?php esc_html_e( 'Re-run', 'agent-ready-shop' ); ?></a>
			</h2>
			<table class="widefat striped" style="max-width:820px">
				<tbody>
				<?php foreach ( $checks as $c ) : ?>
					<tr>
						<td style="width:28px"><span class="dashicons dashicons-<?php echo esc_attr( $icons[ $c['status'] ] ); ?>" style="color:<?php echo esc_attr( $colors[ $c['status'] ] ); ?>"></span></td>
						<td style="width:240px"><strong><?php echo esc_html( $c['label'] ); ?></strong></td>
						<td><?php echo esc_html( $c['note'] ); ?></td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>

			<h2 style="margin-top:2em"><?php esc_html_e( 'Endpoints', 'agent-ready-shop' ); ?></h2>
			<table class="widefat striped" style="max-width:820px">
				<tbody>
				<?php
				$endpoints = array(
					'Manifest'      => home_url( '/.well-known/agent-shop.json' ),
					'llms.txt'      => home_url( '/llms.txt' ),
					'Product feed (JSON)' => rest_url( $ns . '/products' ),
					'OpenAPI spec'  => rest_url( $ns . '/openapi.json' ),
					'Google feed (XML)'   => $settings['enable_xml_feed'] ? home_url( '/agent-shop-feed.xml' ) : null,
				);
				foreach ( $endpoints as $label => $url ) :
					if ( ! $url ) { continue; }
					?>
					<tr>
						<td style="width:240px"><strong><?php echo esc_html( $label ); ?></strong></td>
						<td><a href="<?php echo esc_url( $url ); ?>" target="_blank" rel="noopener"><?php echo esc_html( $url ); ?> <span class="dashicons dashicons-external" style="font-size:14px;height:14px;width:14px;vertical-align:-2px"></span></a></td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>

			<h2 style="margin-top:2em"><?php esc_html_e( 'Settings', 'agent-ready-shop' ); ?></h2>
			<form method="post" action="options.php">
				<?php settings_fields( 'afs_settings_group' ); ?>
				<table class="form-table" role="presentation" style="max-width:820px">
					<tr>
						<th scope="row"><?php esc_html_e( 'Structured data', 'agent-ready-shop' ); ?></th>
						<td>
							<label><input type="checkbox" name="afs_settings[enable_json_ld]" value="1" <?php checked( $settings['enable_json_ld'] ); ?>> <?php esc_html_e( 'Output Product JSON-LD on product pages', 'agent-ready-shop' ); ?></label><br>
							<label><input type="checkbox" name="afs_settings[disable_wc_schema]" value="1" <?php checked( $settings['disable_wc_schema'] ); ?>> <?php esc_html_e( 'Suppress WooCommerce native Product schema (avoid duplicates)', 'agent-ready-shop' ); ?></label>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Agent Ready badge', 'agent-ready-shop' ); ?></th>
						<td>
							<label><input type="checkbox" name="afs_settings[show_badge]" value="1" <?php checked( $settings['show_badge'] ); ?>> <?php esc_html_e( 'Show the "Agent Ready Certified" trust badge in the storefront footer (Pro license required)', 'agent-ready-shop' ); ?></label>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'AI traffic analytics', 'agent-ready-shop' ); ?></th>
						<td>
							<label><input type="checkbox" name="afs_settings[enable_analytics]" value="1" <?php checked( $settings['enable_analytics'] ); ?>> <?php esc_html_e( 'Record visits from AI agents and AI-assistant referrals (30-day rolling window)', 'agent-ready-shop' ); ?></label>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Agentic rate limiting', 'agent-ready-shop' ); ?></th>
						<td>
							<label><input type="checkbox" name="afs_settings[enable_rate_limit]" value="1" <?php checked( $settings['enable_rate_limit'] ); ?>> <?php esc_html_e( 'Protect the agent API with per-agent token buckets (never throttles the checkout money-path)', 'agent-ready-shop' ); ?></label>
							<?php if ( ! AFS_Rate_Limiter::persistent() ) : ?>
								<p class="description" style="color:#996800"><?php esc_html_e( 'No persistent object cache detected — limiter will run in degraded mode (MySQL). Add Redis/Memcached for production.', 'agent-ready-shop' ); ?></p>
							<?php endif; ?>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Block AI training crawlers', 'agent-ready-shop' ); ?></th>
						<td>
							<label><input type="checkbox" name="afs_settings[block_training_bots]" value="1" <?php checked( $settings['block_training_bots'] ); ?>> <?php esc_html_e( 'Disallow model-training bots (CCBot, Google-Extended, Bytespider…) in robots.txt while still welcoming shopping agents', 'agent-ready-shop' ); ?></label>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Google / XML feed', 'agent-ready-shop' ); ?><?php echo $this->pro_badge( 'xf' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></th>
						<td>
							<label><input type="checkbox" name="afs_settings[enable_xml_feed]" value="1" <?php checked( $settings['enable_xml_feed'] ); ?>> <?php esc_html_e( 'Serve a Google Merchant-style feed at /agent-shop-feed.xml', 'agent-ready-shop' ); ?></label><br>
							<label><?php esc_html_e( 'Max items in feed:', 'agent-ready-shop' ); ?> <input type="number" name="afs_settings[feed_max_items]" value="<?php echo esc_attr( $settings['feed_max_items'] ); ?>" min="10" max="5000" step="10" style="width:90px"></label>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="afs_cache_ttl"><?php esc_html_e( 'Feed cache (seconds)', 'agent-ready-shop' ); ?></label><?php echo $this->pro_badge( 'fc' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></th>
						<td>
							<input type="number" id="afs_cache_ttl" name="afs_settings[cache_ttl]" value="<?php echo esc_attr( $settings['cache_ttl'] ); ?>" min="0" step="60" style="width:120px">
							<p class="description"><?php esc_html_e( '0 disables caching. Cache clears automatically when a product is updated.', 'agent-ready-shop' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="afs_llms_intro"><?php esc_html_e( 'llms.txt intro', 'agent-ready-shop' ); ?></label><?php echo $this->pro_badge( 'li' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></th>
						<td><textarea id="afs_llms_intro" name="afs_settings[llms_intro]" rows="3" class="large-text" placeholder="<?php esc_attr_e( 'Optional custom summary for AI agents…', 'agent-ready-shop' ); ?>"><?php echo esc_textarea( $settings['llms_intro'] ); ?></textarea></td>
					</tr>
					<tr>
						<th scope="row"><label for="afs_agents"><?php esc_html_e( 'Allowed AI agents', 'agent-ready-shop' ); ?></label><?php echo $this->pro_badge( 'wc' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></th>
						<td>
							<textarea id="afs_agents" name="afs_settings[allowed_agents]" rows="5" class="large-text code"><?php echo esc_textarea( $settings['allowed_agents'] ); ?></textarea>
							<p class="description"><?php esc_html_e( 'One user-agent per line. Added to robots.txt as explicit Allow rules.', 'agent-ready-shop' ); ?></p>
						</td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}
}
