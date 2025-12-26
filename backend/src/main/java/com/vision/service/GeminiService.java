package com.vision.service;

import com.google.api.client.http.*;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class GeminiService {

    @Value("${gemini.api-key}")
    private String apiKey;

    @Value("${gemini.api-url}")
    private String apiUrl;

    private static final HttpTransport HTTP_TRANSPORT = new NetHttpTransport();
    private static final JsonFactory JSON_FACTORY = new GsonFactory();

    public Map<String, Object> generateContent(String prompt, String model) throws IOException {
        String url = String.format("%s/%s:generateContent?key=%s", apiUrl, model, apiKey);

        Map<String, Object> requestBody = new HashMap<>();
        Map<String, Object> content = new HashMap<>();
        Map<String, String> part = new HashMap<>();
        part.put("text", prompt);
        content.put("parts", List.of(part));
        requestBody.put("contents", List.of(content));

        HttpRequestFactory requestFactory = HTTP_TRANSPORT.createRequestFactory();
        HttpRequest request = requestFactory.buildPostRequest(
                new GenericUrl(url),
                new JsonHttpContent(JSON_FACTORY, requestBody)
        );
        request.getHeaders().setContentType("application/json");

        try {
            HttpResponse response = request.execute();
            String responseBody = response.parseAsString();
            log.info("Gemini API response received");
            
            Map<String, Object> result = new HashMap<>();
            result.put("response", responseBody);
            result.put("success", true);
            return result;
        } catch (HttpResponseException e) {
            log.error("Gemini API error: {}", e.getMessage());
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            error.put("success", false);
            return error;
        }
    }

    public Map<String, Object> generateCode(String description) throws IOException {
        String prompt = String.format(
                "Generate production-ready code based on this description: %s. " +
                "Include all necessary files, imports, and best practices.",
                description
        );
        return generateContent(prompt, "gemini-pro");
    }

    public Map<String, Object> improveCode(String code, String instructions) throws IOException {
        String prompt = String.format(
                "Improve the following code according to these instructions: %s\n\nCode:\n%s",
                instructions, code
        );
        return generateContent(prompt, "gemini-pro");
    }
}
