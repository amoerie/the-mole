using Api.Auth;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace Api.Functions;

public class AuthFunctions
{
    [Function("GetMe")]
    public static IActionResult GetMe(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "me")] HttpRequest req
    )
    {
        var user = AuthHelper.GetUserInfo(req);
        if (user == null)
            return new UnauthorizedResult();

        return new OkObjectResult(
            new
            {
                user.UserId,
                user.DisplayName,
                user.Roles,
            }
        );
    }
}
