package com.vision.controller;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.vision.dto.ApiResponse;
import com.vision.model.Subscription;
import com.vision.model.User;
import com.vision.repository.SubscriptionRepository;
import com.vision.repository.UserRepository;
import com.vision.service.StripeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/subscriptions")
@RequiredArgsConstructor
public class SubscriptionController {

    private final StripeService stripeService;
    private final SubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;

    @Value("${stripe.webhook-secret}")
    private String webhookSecret;

    @GetMapping("/current")
    public ResponseEntity<ApiResponse<Subscription>> getCurrentSubscription(Authentication authentication) {
        UUID userId = getUserIdFromAuth(authentication);
        Subscription subscription = subscriptionRepository.findByUserId(userId)
                .orElse(null);
        return ResponseEntity.ok(ApiResponse.success(subscription));
    }

    @PostMapping("/checkout")
    public ResponseEntity<ApiResponse<Map<String, String>>> createCheckoutSession(
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        try {
            UUID userId = getUserIdFromAuth(authentication);
            String planName = request.get("planName");
            String successUrl = request.get("successUrl");
            String cancelUrl = request.get("cancelUrl");

            Map<String, String> result = stripeService.createCheckoutSession(userId, planName, successUrl, cancelUrl);
            return ResponseEntity.ok(ApiResponse.success("Checkout session created", result));
        } catch (StripeException e) {
            log.error("Stripe error: {}", e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("Failed to create checkout session: " + e.getMessage()));
        }
    }

    @PostMapping("/cancel")
    public ResponseEntity<ApiResponse<Void>> cancelSubscription(Authentication authentication) {
        UUID userId = getUserIdFromAuth(authentication);
        Subscription subscription = subscriptionRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("No active subscription found"));

        subscription.setCancelAtPeriodEnd(true);
        subscriptionRepository.save(subscription);

        return ResponseEntity.ok(ApiResponse.success("Subscription will be cancelled at period end", null));
    }

    @PostMapping("/webhooks/stripe")
    public ResponseEntity<String> handleStripeWebhook(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader) {
        try {
            stripeService.handleWebhook(payload, sigHeader, webhookSecret);
            return ResponseEntity.ok("Webhook handled");
        } catch (SignatureVerificationException e) {
            log.error("Invalid signature: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid signature");
        } catch (StripeException e) {
            log.error("Stripe error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Webhook error");
        }
    }

    private UUID getUserIdFromAuth(Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }
}
