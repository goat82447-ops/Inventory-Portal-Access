using CurdApp.Api.Contracts;
using CurdApp.Api.Data;
using CurdApp.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CurdApp.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductsController(AppDbContext dbContext, IWebHostEnvironment environment) : ControllerBase
{
    private static readonly HashSet<string> AllowedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Product>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? category,
        [FromQuery] bool? isActive)
    {
        var query = dbContext.Products.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(p =>
                p.Name.Contains(search) ||
                p.Description.Contains(search) ||
                p.Sku.Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(p => p.Category == category);
        }

        if (isActive.HasValue)
        {
            query = query.Where(p => p.IsActive == isActive.Value);
        }

        var products = await query
            .OrderBy(p => p.Id)
            .ToListAsync();

        return Ok(products);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Product>> GetById(int id)
    {
        var product = await dbContext.Products.FindAsync(id);
        if (product is null)
        {
            return NotFound();
        }

        return Ok(product);
    }

    [HttpPost]
    public async Task<ActionResult<Product>> Create([FromForm] ProductUpsertRequest request)
    {
        var imageUrl = await SaveImageIfPresent(request.Image);

        var product = new Product
        {
            Name = request.Name.Trim(),
            Description = request.Description.Trim(),
            Sku = request.Sku.Trim(),
            Category = request.Category.Trim(),
            Price = request.Price,
            Quantity = request.Quantity,
            IsActive = request.IsActive,
            ImageUrl = imageUrl,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        dbContext.Products.Add(product);
        await dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromForm] ProductUpsertRequest request)
    {
        var product = await dbContext.Products.FindAsync(id);
        if (product is null)
        {
            return NotFound();
        }

        if (request.Image is not null)
        {
            DeleteImageIfPresent(product.ImageUrl);
            product.ImageUrl = await SaveImageIfPresent(request.Image);
        }
        else if (request.RemoveImage)
        {
            DeleteImageIfPresent(product.ImageUrl);
            product.ImageUrl = null;
        }

        product.Name = request.Name.Trim();
        product.Description = request.Description.Trim();
        product.Sku = request.Sku.Trim();
        product.Category = request.Category.Trim();
        product.Price = request.Price;
        product.Quantity = request.Quantity;
        product.IsActive = request.IsActive;
        product.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var product = await dbContext.Products.FindAsync(id);
        if (product is null)
        {
            return NotFound();
        }

        DeleteImageIfPresent(product.ImageUrl);

        dbContext.Products.Remove(product);
        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> ToggleStatus(int id, [FromQuery] bool isActive)
    {
        var product = await dbContext.Products.FindAsync(id);
        if (product is null)
        {
            return NotFound();
        }

        product.IsActive = isActive;
        product.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();
        return NoContent();
    }

    private async Task<string?> SaveImageIfPresent(IFormFile? image)
    {
        if (image is null || image.Length == 0)
        {
            return null;
        }

        if (image.Length > 5 * 1024 * 1024)
        {
            throw new BadHttpRequestException("Image size should be less than 5 MB.");
        }

        var extension = Path.GetExtension(image.FileName);
        if (!AllowedImageExtensions.Contains(extension))
        {
            throw new BadHttpRequestException("Only JPG, PNG, and WEBP images are supported.");
        }

        var fileName = $"{Guid.NewGuid():N}{extension}";
        var relativePath = Path.Combine("uploads", fileName);
        var absolutePath = Path.Combine(environment.ContentRootPath, "wwwroot", relativePath);

        await using var stream = new FileStream(absolutePath, FileMode.Create);
        await image.CopyToAsync(stream);

        return "/" + relativePath.Replace("\\", "/");
    }

    private void DeleteImageIfPresent(string? imageUrl)
    {
        if (string.IsNullOrWhiteSpace(imageUrl))
        {
            return;
        }

        var relativePath = imageUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var absolutePath = Path.Combine(environment.ContentRootPath, "wwwroot", relativePath);

        if (System.IO.File.Exists(absolutePath))
        {
            System.IO.File.Delete(absolutePath);
        }
    }
}
