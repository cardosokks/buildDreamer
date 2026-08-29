package com.builddreamer.api.controller;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class CustomErrorController implements ErrorController {

    @RequestMapping("/error")
    public ResponseEntity<Map<String, Object>> handleError(HttpServletRequest request) {
        Object status = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        Object message = request.getAttribute(RequestDispatcher.ERROR_MESSAGE);
        Object exception = request.getAttribute(RequestDispatcher.ERROR_EXCEPTION);

        int statusCode = HttpStatus.INTERNAL_SERVER_ERROR.value();
        if (status != null) {
            try {
                statusCode = Integer.parseInt(status.toString());
            } catch (NumberFormatException ignored) {}
        }

        String errorMessage = "Ocorreu um erro no servidor";
        if (message != null && !message.toString().trim().isEmpty()) {
            errorMessage = message.toString();
        } else if (exception instanceof Throwable) {
            errorMessage = ((Throwable) exception).getMessage();
        } else if (statusCode == 404) {
            errorMessage = "Recurso ou rota não encontrada";
        } else if (statusCode == 401) {
            errorMessage = "Não autorizado ou sessão expirada";
        } else if (statusCode == 403) {
            errorMessage = "Acesso negado";
        }

        return ResponseEntity.status(statusCode).body(Map.of(
                "error", errorMessage,
                "status", statusCode
        ));
    }
}
