import { render } from "@testing-library/react";
import AuthenticationGuardComponent from "./AuthenticationGuardComponent";
import {
  clearAccessTokenGetter,
  registerAccessTokenGetter,
} from "../../utils/authBridge";

const mockGetAccessTokenSilently = jest.fn();

jest.mock("@auth0/auth0-react", () => ({
  useAuth0: () => ({
    getAccessTokenSilently: mockGetAccessTokenSilently,
  }),
}));

jest.mock("../../utils/authBridge", () => ({
  registerAccessTokenGetter: jest.fn(),
  clearAccessTokenGetter: jest.fn(),
}));

describe("<AuthenticationGuardComponent />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("registers access token getter on mount", async () => {
    render(<AuthenticationGuardComponent />);

    expect(registerAccessTokenGetter).toHaveBeenCalledTimes(1);
    const registeredGetter = (registerAccessTokenGetter as jest.Mock).mock
      .calls[0][0] as () => Promise<unknown>;

    await registeredGetter();

    expect(mockGetAccessTokenSilently).toHaveBeenCalledTimes(1);
  });

  test("clears the same getter on unmount", () => {
    const { unmount } = render(<AuthenticationGuardComponent />);

    const registeredGetter = (registerAccessTokenGetter as jest.Mock).mock
      .calls[0][0];

    unmount();

    expect(clearAccessTokenGetter).toHaveBeenCalledTimes(1);
    expect(clearAccessTokenGetter).toHaveBeenCalledWith(registeredGetter);
  });
});
