package com.vision.controller;

import com.vision.dto.ApiResponse;
import com.vision.dto.UserDto;
import com.vision.model.User;
import com.vision.repository.UserRepository;
import com.vision.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final UserRepository userRepository;

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<UserDto>> getProfile(Authentication authentication) {
        UUID userId = getUserIdFromAuth(authentication);
        UserDto user = userService.getUserProfile(userId);
        return ResponseEntity.ok(ApiResponse.success(user));
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<UserDto>> updateProfile(
            @RequestBody UserDto dto,
            Authentication authentication) {
        UUID userId = getUserIdFromAuth(authentication);
        UserDto updatedUser = userService.updateUserProfile(userId, dto);
        return ResponseEntity.ok(ApiResponse.success("Profile updated successfully", updatedUser));
    }

    @PutMapping("/password")
    public ResponseEntity<ApiResponse<Void>> updatePassword(
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        UUID userId = getUserIdFromAuth(authentication);
        String currentPassword = request.get("currentPassword");
        String newPassword = request.get("newPassword");
        
        userService.updatePassword(userId, currentPassword, newPassword);
        return ResponseEntity.ok(ApiResponse.success("Password updated successfully", null));
    }

    private UUID getUserIdFromAuth(Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }
}
