<?php
declare(strict_types=1);

// Copy to auth/config.php, or keep outside the public directory and set
// TIMETABLE_AUTH_CONFIG to its absolute filesystem path. Never commit secrets.
return [
    'tenant_id' => '', // Directory (tenant) ID, UUID; not "common".
    'client_id' => '', // Application (client) ID, UUID.
    'client_secret' => '', // Secret VALUE, not the secret's ID.
    'app_url' => 'https://example.org/TimetableWrapper/index.php',
    // Register app_url + ?auth=callback as a Web redirect URI in Entra ID.
    'plan_dir' => dirname(__DIR__, 2) . '/plan',
    'archive_dir' => dirname(__DIR__, 2) . '/stareplany',
    // Both folders MUST be outside the public directory or blocked by .htaccess.
    'session_seconds' => 3600,
    // Optional Entra app role value, e.g. Plan.Read; empty = any user in tenant.
    'required_role' => '',
];
