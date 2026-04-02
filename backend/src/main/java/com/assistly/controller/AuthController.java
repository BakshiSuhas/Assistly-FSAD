package com.assistly.controller;

import com.assistly.model.Role;
import com.assistly.model.User;
import com.assistly.payload.request.LoginRequest;
import com.assistly.payload.request.ResetPasswordRequest;
import com.assistly.payload.request.SignupRequest;
import com.assistly.payload.response.JwtResponse;
import com.assistly.payload.response.MessageResponse;
import com.assistly.repository.UserRepository;
import com.assistly.security.jwt.JwtUtils;
import com.assistly.security.services.UserDetailsImpl;
import com.assistly.model.AuthProvider;
import com.assistly.payload.request.GoogleLoginRequest;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.beans.factory.annotation.Value;
import java.util.Collections;
import java.util.Locale;
import java.util.Optional;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @Autowired
    AuthenticationManager authenticationManager;

    @Autowired
    UserRepository userRepository;

    @Autowired
    PasswordEncoder encoder;

    @Autowired
    JwtUtils jwtUtils;

    @Value("${google.client.id}")
    private String googleClientId;

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {
        String normalizedEmail = normalizeEmail(loginRequest.getEmail());
        if (!userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Account not found. Please sign up first."));
        }
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(normalizedEmail, loginRequest.getPassword()));
            return buildJwtResponse(authentication);
        } catch (AuthenticationException ex) {
            // Backward-compatible password migration:
            // allow one-time login for legacy plain-text LOCAL accounts, then store BCrypt hash.
            Optional<User> legacyUser = userRepository.findByEmailIgnoreCase(normalizedEmail);
            if (legacyUser.isPresent()) {
                User user = legacyUser.get();
                String storedPassword = user.getPassword();
                boolean isLocalUser = user.getProvider() == null || user.getProvider() == AuthProvider.LOCAL;
                boolean looksPlainText = storedPassword != null && !storedPassword.startsWith("$2");
                if (isLocalUser && looksPlainText && storedPassword.equals(loginRequest.getPassword())) {
                    user.setPassword(encoder.encode(loginRequest.getPassword()));
                    userRepository.save(user);
                    Authentication retryAuthentication = authenticationManager.authenticate(
                            new UsernamePasswordAuthenticationToken(normalizedEmail, loginRequest.getPassword()));
                    return buildJwtResponse(retryAuthentication);
                }
            }
            throw ex;
        }
    }

    private ResponseEntity<?> buildJwtResponse(Authentication authentication) {
        SecurityContextHolder.getContext().setAuthentication(authentication);
        String jwt = jwtUtils.generateJwtToken(authentication);

        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        String role = userDetails.getAuthorities().iterator().next().getAuthority();

        return ResponseEntity.ok(new JwtResponse(jwt,
                userDetails.getId(),
                userDetails.getName(),
                userDetails.getEmail(),
                role,
                userDetails.isVolunteer()));
    }

    @PostMapping("/signup")
    public ResponseEntity<?> registerUser(@Valid @RequestBody SignupRequest signUpRequest) {
        String normalizedEmail = normalizeEmail(signUpRequest.getEmail());
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            return ResponseEntity
                    .badRequest()
                    .body(new MessageResponse("Error: Email is already in use!"));
        }

        // Dynamically assign ADMIN role if the payload structurally invokes explicit credentials
        Role userRole = (signUpRequest.getRole() != null && signUpRequest.getRole().equalsIgnoreCase("ADMIN")) ? Role.ADMIN : Role.USER;

        User user = new User(signUpRequest.getName(),
                normalizedEmail,
                encoder.encode(signUpRequest.getPassword()),
                userRole);

        userRepository.save(user);

        return ResponseEntity.ok(new MessageResponse("User registered successfully!"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        String normalizedEmail = normalizeEmail(request.getEmail());
        Optional<User> userOptional = userRepository.findByEmailIgnoreCase(normalizedEmail);
        if (userOptional.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Account not found for this email."));
        }

        User user = userOptional.get();
        if (user.getProvider() == AuthProvider.GOOGLE) {
            return ResponseEntity.badRequest().body(new MessageResponse("Google account password cannot be reset here."));
        }

        user.setPassword(encoder.encode(request.getNewPassword()));
        userRepository.save(user);
        return ResponseEntity.ok(new MessageResponse("Password reset successful. Please login."));
    }

    @PostMapping("/google")
    public ResponseEntity<?> authenticateGoogle(@Valid @RequestBody GoogleLoginRequest loginRequest) {
        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(loginRequest.getTokenId());
            if (idToken != null) {
                GoogleIdToken.Payload payload = idToken.getPayload();
                String email = normalizeEmail(payload.getEmail());
                String name = (String) payload.get("name");

                Optional<User> userOptional = userRepository.findByEmailIgnoreCase(email);
                User user;
                if (userOptional.isPresent()) {
                    user = userOptional.get();
                } else {
                    user = new User(name, email, encoder.encode("oauth2user"), Role.USER, AuthProvider.GOOGLE);
                    userRepository.save(user);
                }

                // Create Spring authentication token
                UserDetailsImpl userDetails = UserDetailsImpl.build(user);
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                SecurityContextHolder.getContext().setAuthentication(authentication);

                String jwt = jwtUtils.generateJwtToken(authentication);

                String role = userDetails.getAuthorities().iterator().next().getAuthority();

                return ResponseEntity.ok(new JwtResponse(jwt,
                        userDetails.getId(),
                        userDetails.getName(),
                        userDetails.getEmail(),
                        role,
                        userDetails.isVolunteer()));

            } else {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid Google ID token."));
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Authentication failed: " + e.getMessage()));
        }
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
