package com.assistly.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Set;
import java.util.HashSet;
import com.fasterxml.jackson.annotation.JsonIgnore;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Column(unique = true, nullable = false)
    private String email;

    @JsonIgnore
    private String password;

    @Enumerated(EnumType.STRING)
    private Role role = Role.USER;

    @Enumerated(EnumType.STRING)
    private AuthProvider provider = AuthProvider.LOCAL;

    // To differentiate between Resident and Volunteer
    private boolean isVolunteer = false;

    @ManyToMany(mappedBy = "members")
    @JsonIgnore
    private Set<Community> communities = new HashSet<>();

    public User(String name, String email, String password, Role role, AuthProvider provider) {
        this.name = name;
        this.email = email;
        this.password = password;
        this.role = role;
        this.provider = provider;
    }

    public User(String name, String email, String password, Role role) {
        this.name = name;
        this.email = email;
        this.password = password;
        this.password = password;
        this.role = role;
        this.provider = AuthProvider.LOCAL;
    }

    public User() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public AuthProvider getProvider() { return provider; }
    public void setProvider(AuthProvider provider) { this.provider = provider; }
    public boolean isVolunteer() { return isVolunteer; }
    public void setVolunteer(boolean isVolunteer) { this.isVolunteer = isVolunteer; }
    public Set<Community> getCommunities() { return communities; }
    public void setCommunities(Set<Community> communities) { this.communities = communities; }
}
