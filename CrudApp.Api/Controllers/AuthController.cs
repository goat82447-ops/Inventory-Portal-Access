using CurdApp.Api.Contracts;
using CurdApp.Api.Data;
using CurdApp.Api.Models;
using CurdApp.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CurdApp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(
    AppDbContext dbContext,
    PasswordService passwordService,
    JwtTokenService jwtTokenService) : ControllerBase
{
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        var username = request.Username.Trim();
        var email = request.Email.Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest("Username, email, and password are required.");
        }

        if (request.Password.Length < 6)
        {
            return BadRequest("Password must be at least 6 characters.");
        }

        var exists = await dbContext.Users.AnyAsync(u =>
            u.Username.ToLower() == username.ToLower() ||
            u.Email.ToLower() == email);

        if (exists)
        {
            return Conflict("User with this username or email already exists.");
        }

        var (hash, salt) = passwordService.HashPassword(request.Password);

        var user = new AppUser
        {
            Username = username,
            Email = email,
            PasswordHash = hash,
            PasswordSalt = salt,
            CreatedAtUtc = DateTime.UtcNow
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var (token, expiresAtUtc) = jwtTokenService.CreateToken(user);

        return Ok(new AuthResponse
        {
            Token = token,
            ExpiresAtUtc = expiresAtUtc,
            Username = user.Username,
            Email = user.Email
        });
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var key = request.UsernameOrEmail.Trim();

        var user = await dbContext.Users.FirstOrDefaultAsync(u =>
            u.Username.ToLower() == key.ToLower() ||
            u.Email.ToLower() == key.ToLower());

        if (user is null)
        {
            return Unauthorized("Invalid credentials.");
        }

        var isValidPassword = passwordService.VerifyPassword(request.Password, user.PasswordHash, user.PasswordSalt);
        if (!isValidPassword)
        {
            return Unauthorized("Invalid credentials.");
        }

        var (token, expiresAtUtc) = jwtTokenService.CreateToken(user);

        return Ok(new AuthResponse
        {
            Token = token,
            ExpiresAtUtc = expiresAtUtc,
            Username = user.Username,
            Email = user.Email
        });
    }
}
