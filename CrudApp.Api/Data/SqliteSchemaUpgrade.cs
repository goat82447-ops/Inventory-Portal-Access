using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace CurdApp.Api.Data;

public static class SqliteSchemaUpgrade
{
    public static async Task EnsureProductColumnsAsync(AppDbContext dbContext)
    {
        await using var connection = new SqliteConnection(dbContext.Database.GetDbConnection().ConnectionString);
        await connection.OpenAsync();

        await EnsureUsersTableAsync(connection);

        var existingColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        await using (var command = connection.CreateCommand())
        {
            command.CommandText = "PRAGMA table_info('Products');";
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                existingColumns.Add(reader.GetString(1));
            }
        }

        await AddColumnIfMissing(connection, existingColumns, "Sku", "TEXT NOT NULL DEFAULT ''");
        await AddColumnIfMissing(connection, existingColumns, "Category", "TEXT NOT NULL DEFAULT ''");
        await AddColumnIfMissing(connection, existingColumns, "IsActive", "INTEGER NOT NULL DEFAULT 1");
        await AddColumnIfMissing(connection, existingColumns, "ImageUrl", "TEXT");
        await AddColumnIfMissing(connection, existingColumns, "CreatedAtUtc", "TEXT");
        await AddColumnIfMissing(connection, existingColumns, "UpdatedAtUtc", "TEXT");
    }

    private static async Task EnsureUsersTableAsync(SqliteConnection connection)
    {
        const string createUsersSql = """
            CREATE TABLE IF NOT EXISTS Users (
                Id INTEGER NOT NULL CONSTRAINT PK_Users PRIMARY KEY AUTOINCREMENT,
                Username TEXT NOT NULL,
                Email TEXT NOT NULL,
                PasswordHash BLOB NOT NULL,
                PasswordSalt BLOB NOT NULL,
                CreatedAtUtc TEXT NOT NULL
            );
            """;

        const string usernameIndexSql = "CREATE UNIQUE INDEX IF NOT EXISTS IX_Users_Username ON Users(Username);";
        const string emailIndexSql = "CREATE UNIQUE INDEX IF NOT EXISTS IX_Users_Email ON Users(Email);";

        await using var createCommand = connection.CreateCommand();
        createCommand.CommandText = createUsersSql;
        await createCommand.ExecuteNonQueryAsync();

        await using var usernameIndexCommand = connection.CreateCommand();
        usernameIndexCommand.CommandText = usernameIndexSql;
        await usernameIndexCommand.ExecuteNonQueryAsync();

        await using var emailIndexCommand = connection.CreateCommand();
        emailIndexCommand.CommandText = emailIndexSql;
        await emailIndexCommand.ExecuteNonQueryAsync();
    }

    private static async Task AddColumnIfMissing(SqliteConnection connection, HashSet<string> existingColumns, string columnName, string definition)
    {
        if (existingColumns.Contains(columnName))
        {
            return;
        }

        await using var alterCommand = connection.CreateCommand();
        alterCommand.CommandText = $"ALTER TABLE Products ADD COLUMN {columnName} {definition};";
        await alterCommand.ExecuteNonQueryAsync();
    }
}
