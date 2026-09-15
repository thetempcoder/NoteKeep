<?php
/**
 * NoteKeep - API REST de Marcadores (Labels)
 */

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? '';

function getJsonInput() {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?: [];
}

switch ($method) {
    case 'GET':
        $stmt = $pdo->query("SELECT * FROM labels ORDER BY name ASC");
        echo json_encode($stmt->fetchAll());
        break;

    case 'POST':
        $data = getJsonInput();
        $name = trim($data['name'] ?? '');

        if (!$name) {
            http_response_code(400);
            echo json_encode(['error' => 'Nome do marcador não pode ser vazio']);
            exit;
        }

        $labelId = $data['id'] ?? ('lbl_' . time() . '_' . bin2hex(random_bytes(3)));

        try {
            $stmt = $pdo->prepare("INSERT INTO labels (id, name) VALUES (?, ?)");
            $stmt->execute([$labelId, $name]);
            echo json_encode(['id' => $labelId, 'name' => $name]);
        } catch (PDOException $e) {
            http_response_code(409);
            echo json_encode(['error' => 'Marcador já existe']);
        }
        break;

    case 'PUT':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID do marcador não especificado']);
            exit;
        }

        $data = getJsonInput();
        $name = trim($data['name'] ?? '');

        if (!$name) {
            http_response_code(400);
            echo json_encode(['error' => 'Nome do marcador não pode ser vazio']);
            exit;
        }

        $stmt = $pdo->prepare("UPDATE labels SET name = ? WHERE id = ?");
        $stmt->execute([$name, $id]);
        echo json_encode(['id' => $id, 'name' => $name]);
        break;

    case 'DELETE':
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID do marcador não especificado']);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM labels WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Marcador excluído']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método não permitido']);
        break;
}
