{
  description = "StockDB: dev shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      forSystems = nixpkgs.lib.genAttrs [
        "x86_64-linux"
        "aarch64-darwin"
      ];
    in
    {
      devShells = forSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.cargo
              pkgs.rustc
              pkgs.clippy
              pkgs.rustfmt
              pkgs.rust-analyzer
              pkgs.pkg-config
              # reqwest's default TLS links against openssl, diesel's postgres backend against libpq.
              pkgs.openssl
              pkgs.postgresql
              # argonautica generates its argon2 bindings with bindgen, which needs libclang.
              pkgs.rustPlatform.bindgenHook
              pkgs.nodejs
              # pnpm switches itself to the version in web/package.json's packageManager.
              pkgs.pnpm
            ];
          };
        }
      );
    };
}
