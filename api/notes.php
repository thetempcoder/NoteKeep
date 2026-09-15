<?php
/**
 * NoteKeep - API REST de Notas
 */

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id = $_GET['id'] ?? '';

// Função auxiliar para decodificar JSON do corpo
function getJsonInput() {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?: [];
}

// Formatar dados da nota para o cliente
function formatNoteRow($row) {
    if (!$row) return null;
    $row['is_pinned'] = (bool)$row['is_pinned'];
    $row['is_archived'] = (bool)$row['is_archived'];
    $row['is_trashed'] = (bool)$row['is_trashed'];
    $row['checklist_items'] = json_decode($row['checklist_items'] ?: '[]', true);
    $row['labels'] = json_decode($row['labels'] ?: '[]', true);
    return $row;
}

switch ($method) {
    case 'GET':
        if ($id) {
            $stmt = $pdo->prepare("SELECT * FROM notes WHERE id = ?");
            $stmt->execute([$id]);
            $note = $stmt->fetch();
            if ($note) {
                echo json_encode(formatNoteRow($note));
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Nota não encontrada']);
            }
        } else {
            $stmt = $pdo->query("SELECT * FROM notes ORDER BY updated_at DESC");
            $notes = array_map('formatNoteRow', $stmt->fetchAll());
            echo json_encode($notes);
        }
        break;

    case 'POST':
        if ($action === 'empty_trash') {
            $pdo->exec("DELETE FROM notes WHERE is_trashed = 1");
            echo json_encode(['success' => true, 'message' => 'Lixeira esvaziada com sucesso']);
            break;
        }

        $data = getJsonInput();
        $noteId = $data['id'] ?? ('note_' . time() . '_' . bin2hex(random_bytes(4)));
        $title = $data['title'] ?? '';
        $content = $data['content'] ?? '';
        $type = $data['type'] ?? 'text';
        $checklist = json_encode($data['checklist_items'] ?? []);
        $color = $data['color'] ?? 'default';
        $isPinned = !empty($data['is_pinned']) ? 1 : 0;
        $isArchived = !empty($data['is_archived']) ? 1 : 0;
        $isTrashed = !empty($data['is_trashed']) ? 1 : 0;
        $labels = json_encode($data['labels'] ?? []);
        $reminder = $data['reminder'] ?? null;
        $now = date('Y-m-d H:i:s');

        $stmt = $pdo->prepare("
            INSERT INTO notes (id, title, content, type, checklist_items, color, is_pinned, is_archived, is_trashed, labels, reminder, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$noteId, $title, $content, $type, $checklist, $color, $isPinned, $isArchived, $isTrashed, $labels, $reminder, $now, $now]);

        $stmt = $pdo->prepare("SELECT * FROM notes WHERE id = ?");
        $stmt->execute([$noteId]);
        echo json_encode(formatNoteRow($stmt->fetch()), JSON_UNESCAPED_UNICODE);
        break;

    case 'PUT':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID da nota não especificado']);
            exit;
        }

        $data = getJsonInput();
        $updates = [];
        $params = [];

        $fields = [
            'title' => 'title',
            'content' => 'content',
            'type' => 'type',
            'color' => 'color',
            'reminder' => 'reminder'
        ];

        foreach ($fields as $key => $col) {
            if (array_key_exists($key, $data)) {
                $updates[] = "$col = ?";
                $params[] = $data[$key];
            }
        }

        if (array_key_exists('checklist_items', $data)) {
            $updates[] = "checklist_items = ?";
            $params[] = json_encode($data['checklist_items']);
        }
        if (array_key_exists('labels', $data)) {
            $updates[] = "labels = ?";
            $params[] = json_encode($data['labels']);
        }
        if (array_key_exists('is_pinned', $data)) {
            $updates[] = "is_pinned = ?";
            $params[] = $data['is_pinned'] ? 1 : 0;
        }
        if (array_key_exists('is_archived', $data)) {
            $updates[] = "is_archived = ?";
            $params[] = $data['is_archived'] ? 1 : 0;
        }
        if (array_key_exists('is_trashed', $data)) {
            $updates[] = "is_trashed = ?";
            $params[] = $data['is_trashed'] ? 1 : 0;
        }

        $updates[] = "updated_at = CURRENT_TIMESTAMP";
        $params[] = $id;

        $sql = "UPDATE notes SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $stmt = $pdo->prepare("SELECT * FROM notes WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(formatNoteRow($stmt->fetch()), JSON_UNESCAPED_UNICODE);
        break;

    case 'DELETE':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID da nota não especificado']);
            exit;
        }

        // Se passar ?permanent=1 exclui do banco, caso contrário move para lixeira
        $permanent = !empty($_GET['permanent']);
        if ($permanent) {
            $stmt = $pdo->prepare("DELETE FROM notes WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Nota excluída permanentemente']);
        } else {
            $stmt = $pdo->prepare("UPDATE notes SET is_trashed = 1, is_pinned = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Nota movida para a lixeira']);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método não permitido']);
        break;
}
