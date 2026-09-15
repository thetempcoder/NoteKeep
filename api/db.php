<?php
/**
 * NoteKeep - Conexão e Inicialização do Banco de Dados SQLite
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dbDir = __DIR__ . '/../data';
if (!is_dir($dbDir)) {
    mkdir($dbDir, 0777, true);
}

$dbPath = $dbDir . '/keep.db';

try {
    $pdo = new PDO("sqlite:" . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Criar tabela de notas se não existir
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT,
            content TEXT,
            type TEXT DEFAULT 'text', -- 'text' ou 'checklist'
            checklist_items TEXT,     -- JSON array de [{id, text, completed}]
            color TEXT DEFAULT 'default',
            is_pinned INTEGER DEFAULT 0,
            is_archived INTEGER DEFAULT 0,
            is_trashed INTEGER DEFAULT 0,
            labels TEXT,              -- JSON array de strings
            reminder TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    // Criar tabela de marcadores se não existir
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS labels (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Falha ao conectar com o banco de dados SQLite: ' . $e->getMessage()
    ]);
    exit;
}
