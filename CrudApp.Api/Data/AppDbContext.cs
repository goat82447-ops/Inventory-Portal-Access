using CurdApp.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CurdApp.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<AppUser> Users => Set<AppUser>();
}
